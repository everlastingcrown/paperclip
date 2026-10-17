import { createHash, createPrivateKey, createSign } from "node:crypto";
import type { ConnectionGrant } from "@paperclipai/shared";
import { unprocessable } from "../errors.js";

export const GITHUB_APP_METHOD = "app-installation";
export const GITHUB_APP_KEY_PATH = "credentials.privateKey";
const FRESH_MS = 5 * 60_000;
const MAX_CACHE = 128;
type Metadata = NonNullable<ConnectionGrant["providerTenant"]>["github"];
export type GitHubAppConfig = {
  version: 1;
  appId: string;
  installationId: string;
  repositories: string[];
  permissions: Record<string, "read" | "write">;
};
const profiles = {
  read: { contents: "read", pull_requests: "read", issues: "read" },
  author: { contents: "write", pull_requests: "write", issues: "read" },
  reviewer: { contents: "read", pull_requests: "write", issues: "read" },
} as const;
export function githubAppFailure(): never {
  throw unprocessable("GitHub App access is unavailable. Check the App key, installation, selected repositories, and permissions.", { code: "github_app_access_unavailable" });
}
export function isGitHubAppConnection(connection: { config: Record<string, unknown> }) {
  return connection.config.sourceTemplateKey === "github" && connection.config.connectionMethodKey === GITHUB_APP_METHOD;
}
export function parseGitHubAppConfig(value: unknown): GitHubAppConfig {
  const v = value as Record<string, unknown> | null;
  if (!v || !/^[1-9]\d*$/.test(String(v.appId ?? "")) || !/^[1-9]\d*$/.test(String(v.installationId ?? ""))
    || typeof v.repositories !== "string" || !Object.hasOwn(profiles, String(v.permissionProfile))) githubAppFailure();
  const repositories = [...new Set(v.repositories.split(/[,\n]/).map(s => s.trim().toLowerCase()).filter(Boolean))].sort();
  if (!repositories.length || repositories.length > 500 || repositories.some(r => !/^[a-z0-9][a-z0-9-]*\/[a-z0-9_.-]+$/.test(r))) githubAppFailure();
  return { version: 1, appId: String(v.appId), installationId: String(v.installationId), repositories,
    permissions: { ...profiles[v.permissionProfile as keyof typeof profiles] } };
}
export function githubAppJwt(appId: string, privateKey: string, now = Date.now()) {
  const key = createPrivateKey(privateKey);
  if (key.asymmetricKeyType !== "rsa") githubAppFailure();
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const issued = Math.floor(now / 1000) - 60;
  const body = Buffer.from(JSON.stringify({ iat: issued, exp: issued + 600, iss: appId })).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${body}`);
  return `${header}.${body}.${signer.sign(key).toString("base64url")}`;
}
export type AppCredential = { token: string; expiresAt: number; github: NonNullable<Metadata> };
/** Fixed provider origin; never follow a redirect carrying an App JWT or token. */
export function createGitHubAppClient(fetcher: typeof fetch = fetch, clock = Date.now) {
  const cache = new Map<string, { until: number; settled: boolean; promise: Promise<AppCredential> }>();
  async function request(path: string, token: string, body?: unknown): Promise<any> {
    const response = await fetcher(`https://api.github.com${path}`, {
      method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) githubAppFailure();
    return response.json();
  }
  async function acquire(config: GitHubAppConfig, key: string): Promise<AppCredential> {
    const jwt = githubAppJwt(config.appId, key, clock());
    const app = await request("/app", jwt);
    const installation = await request(`/app/installations/${config.installationId}`, jwt);
    if (String(app.id) !== config.appId || typeof app.slug !== "string" || !/^[a-z0-9-]+$/.test(app.slug)
      || String(installation.id) !== config.installationId || String(installation.app_id) !== config.appId
      || installation.suspended_at || typeof installation.account?.login !== "string") githubAppFailure();
    const owner = installation.account.login.toLowerCase();
    if (config.repositories.some(repo => repo.split("/")[0] !== owner)) githubAppFailure();
    for (const [name, level] of Object.entries(config.permissions)) {
      const allowed = installation.permissions?.[name];
      if (allowed !== "write" && allowed !== level) githubAppFailure();
    }
    const minted = await request(`/app/installations/${config.installationId}/access_tokens`, jwt, {
      repositories: config.repositories.map(repo => repo.split("/")[1]), permissions: config.permissions,
    });
    const expiresAt = Date.parse(minted.expires_at);
    if (typeof minted.token !== "string" || !minted.token.trim() || !Number.isFinite(expiresAt) || expiresAt <= clock() + 60_000) githubAppFailure();
    // Identity is the provider's bot account, never the installation owner.
    const bot = await request(`/users/${encodeURIComponent(`${app.slug}[bot]`)}`, minted.token);
    if (bot.login !== `${app.slug}[bot]` || bot.type !== "Bot" || !Number.isSafeInteger(bot.id) || bot.id < 1) githubAppFailure();
    const repositories: NonNullable<NonNullable<Metadata>["repositories"]> = [];
    for (let page = 1; page <= 6; page++) {
      const data = await request(`/installation/repositories?per_page=100&page=${page}`, minted.token);
      if (!Array.isArray(data.repositories)) githubAppFailure();
      for (const repo of data.repositories) {
        if (!Number.isSafeInteger(repo.id) || typeof repo.full_name !== "string" || !config.repositories.includes(repo.full_name.toLowerCase())) githubAppFailure();
        repositories.push({ id: String(repo.id), fullName: repo.full_name, installationId: config.installationId, private: repo.private === true });
      }
      if (data.repositories.length < 100) break;
      if (page === 6) githubAppFailure();
    }
    if (new Set(repositories.map(r => r.fullName.toLowerCase())).size !== config.repositories.length) githubAppFailure();
    return { token: minted.token, expiresAt, github: {
      userId: String(bot.id), login: bot.login, appSlug: app.slug,
      installationCount: 1, repositoryCount: repositories.length, repositorySelection: "selected",
      installationIds: [config.installationId], installationOwnerLogins: [installation.account.login], repositories,
      managementUrl: `https://github.com/settings/installations/${config.installationId}`,
      lastAccessRefreshAt: new Date(clock()).toISOString(),
    } };
  }
  return {
    async acquire(namespace: string, config: GitHubAppConfig, key: string, force = false) {
      const hash = createHash("sha256").update(JSON.stringify(config)).update(key).digest("hex");
      const cacheKey = `${namespace}:${hash}`;
      const current = cache.get(cacheKey);
      if (current && !current.settled) return current.promise;
      if (!force && current && current.until > clock()) return current.promise;
      if ([...cache.values()].filter(entry => !entry.settled).length >= 16) githubAppFailure();
      if (cache.size >= MAX_CACHE) {
        const oldest = [...cache.entries()].find(([, entry]) => entry.settled);
        if (!oldest) githubAppFailure();
        cache.delete(oldest[0]);
      }
      const entry = { until: clock() + FRESH_MS, settled: false, promise: acquire(config, key).catch(() => githubAppFailure()) };
      cache.set(cacheKey, entry);
      try {
        const result = await entry.promise;
        entry.until = Math.min(entry.until, result.expiresAt - 60_000);
        entry.settled = true;
        return result;
      } catch { if (cache.get(cacheKey) === entry) cache.delete(cacheKey); githubAppFailure(); }
    },
  };
}
