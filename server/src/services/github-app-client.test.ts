import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createGitHubAppClient, githubAppJwt, parseGitHubAppConfig } from "./github-app-client.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const base = { appId: "123", installationId: "456", repositories: "owner/repo", permissionProfile: "author" };
const config = parseGitHubAppConfig(base);
const start = Date.parse("2026-10-18T00:00:00Z");
function fixture(overrides: Record<string, unknown> = {}, expiresIn = 3_600_000) {
  let now = start;
  const bodies: Record<string, unknown> = {
    "/app": { id: 123, slug: "test-app" },
    "/app/installations/456": { id: 456, app_id: 123, account: { login: "owner" }, permissions: { contents: "write", pull_requests: "write", issues: "read" } },
    "/app/installations/456/access_tokens": { token: "opaque.new-format.token", expires_at: new Date(start + expiresIn).toISOString() },
    "/users/test-app%5Bbot%5D": { id: 789, login: "test-app[bot]", type: "Bot" },
    "/installation/repositories?per_page=100&page=1": { repositories: [{ id: 321, full_name: "owner/repo", private: true }] },
    ...overrides,
  };
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const key = String(url).replace("https://api.github.com", "");
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const body = bodies[key];
    return new Response(JSON.stringify(body ?? { message: "sensitive provider error" }), { status: body ? 200 : 403 });
  });
  return { fetcher, client: createGitHubAppClient(fetcher as typeof fetch, () => now), advance: (ms: number) => { now += ms; } };
}

describe("customer-owned GitHub App protocol", () => {
  it("signs an RSA JWT with clock-skew allowance and a ten-minute maximum lifetime", () => {
    const jwt = githubAppJwt("123", privateKey, start);
    const [header, payload, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header!, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(payload!, "base64url").toString())).toEqual({ iss: "123", iat: start / 1000 - 60, exp: start / 1000 + 540 });
    expect(verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature!, "base64url"))).toBe(true);
  });

  it.each(["", "owner/repo,https://evil.test", "owner/../repo"])("denies empty or malformed repository scope %s", repositories => {
    expect(() => parseGitHubAppConfig({ ...base, repositories })).toThrow();
  });
  it.each(["toString", "admin", "__proto__"])("rejects an unknown permission profile %s", permissionProfile => {
    expect(() => parseGitHubAppConfig({ ...base, permissionProfile })).toThrow();
  });
  it("normalizes repository scope without widening it", () => {
    expect(parseGitHubAppConfig({ ...base, repositories: "Owner/Repo,owner/repo\nowner/second" }).repositories).toEqual(["owner/repo", "owner/second"]);
  });

  it("mints with explicit restrictions and returns the verified bot, not the installation owner", async () => {
    const { client, fetcher } = fixture();
    const result = await client.acquire("company:connection:grant:revision", config, privateKey);
    expect(result.github).toMatchObject({ userId: "789", login: "test-app[bot]", installationOwnerLogins: ["owner"], repositoryCount: 1 });
    expect(result.token).toBe("opaque.new-format.token");
    const mint = fetcher.mock.calls.find(([url]) => String(url).endsWith("/access_tokens"))!;
    expect(JSON.parse(mint[1]!.body as string)).toEqual({ repositories: ["repo"], permissions: { contents: "write", pull_requests: "write", issues: "read" } });
    expect(fetcher.mock.calls.every(([url]) => !String(url).includes("/user/repos") && !String(url).endsWith("/user"))).toBe(true);
  });

  it.each([
    { "/app": { id: 124, slug: "test-app" } },
    { "/app/installations/456": { id: 456, app_id: 999, account: { login: "owner" } } },
    { "/app/installations/456": { id: 456, app_id: 123, suspended_at: "now", account: { login: "owner" } } },
    { "/app/installations/456": { id: 456, app_id: 123, account: { login: "another-owner" } } },
    { "/app/installations/456": { id: 456, app_id: 123, account: { login: "owner" }, permissions: { contents: "read" } } },
  ])("rejects an incorrect installation or insufficient permissions before minting", async overrides => {
    const { client, fetcher } = fixture(overrides);
    await expect(client.acquire("scope", config, privateKey)).rejects.toThrow("GitHub App access is unavailable");
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith("/access_tokens"))).toBe(false);
  });

  it.each([
    { "/app/installations/456/access_tokens": { token: "secret", expires_at: "invalid" } },
    { "/app/installations/456/access_tokens": { token: "secret", expires_at: new Date(start - 1).toISOString() } },
    { "/users/test-app%5Bbot%5D": { id: 42, login: "owner", type: "User" } },
    { "/installation/repositories?per_page=100&page=1": { repositories: [] } },
    { "/installation/repositories?per_page=100&page=1": { repositories: [{ id: 42, full_name: "owner/other" }] } },
  ])("fails closed on malformed, expired, or broader provider results", async overrides => {
    const { client } = fixture(overrides);
    await expect(client.acquire("scope", config, privateKey)).rejects.toThrow("GitHub App access is unavailable");
  });

  it("deduplicates concurrent acquisition, caches only within five minutes, and isolates principals", async () => {
    const { client, fetcher, advance } = fixture();
    await Promise.all(Array.from({ length: 8 }, () => client.acquire("a", config, privateKey)));
    expect(fetcher).toHaveBeenCalledTimes(5);
    await client.acquire("b", config, privateKey);
    expect(fetcher).toHaveBeenCalledTimes(10);
    advance(5 * 60_000);
    await client.acquire("a", config, privateKey);
    expect(fetcher).toHaveBeenCalledTimes(15);
  });

  it("separates permission changes and key revisions from cached credentials", async () => {
    const { client, fetcher } = fixture();
    await client.acquire("rev1", config, privateKey);
    await client.acquire("rev2", config, privateKey);
    await client.acquire("rev2", parseGitHubAppConfig({ ...base, permissionProfile: "reviewer" }), privateKey);
    expect(fetcher).toHaveBeenCalledTimes(15);
  });

  it("refreshes before the provider expiry even inside the metadata refresh interval", async () => {
    const { client, fetcher, advance } = fixture({}, 120_000);
    await client.acquire("scope", config, privateKey);
    advance(60_001);
    await expect(client.acquire("scope", config, privateKey)).rejects.toThrow();
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/access_tokens"))).toHaveLength(2);
  });

  it("redacts provider and crypto errors, and does not cache failed issuance", async () => {
    const fetcher = vi.fn(async () => { throw new Error("sensitive key or provider body"); });
    const client = createGitHubAppClient(fetcher);
    await expect(client.acquire("scope", config, "broken PEM")).rejects.toThrow("GitHub App access is unavailable");
    await expect(client.acquire("scope", config, privateKey)).rejects.toThrow("GitHub App access is unavailable");
    await expect(client.acquire("scope", config, privateKey)).rejects.toThrow("GitHub App access is unavailable");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
