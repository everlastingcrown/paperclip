import { and, eq } from "drizzle-orm";
import { connectionGrants, toolConnections, toolConnectionInstalls, type Db } from "@paperclipai/db";
import { resolveConnectionGrantSecret } from "./connection-credentials.js";
import { createGitHubAppClient, GITHUB_APP_KEY_PATH, isGitHubAppConnection, parseGitHubAppConfig, githubAppFailure, rethrowGitHubAppFailure } from "./github-app-client.js";

export { isGitHubAppConnection, parseGitHubAppConfig } from "./github-app-client.js";
type Connection = typeof toolConnections.$inferSelect;
type Grant = typeof connectionGrants.$inferSelect;
const client = createGitHubAppClient();

/** Authorization and vault ownership are rechecked even on a token-cache hit. */
export async function resolveGitHubAppCredential(db: Db, connection: Connection, grant: Grant, allowDraft = false, force = false) {
  const valid = async () => {
    const [c] = await db.select().from(toolConnections).where(and(eq(toolConnections.companyId, connection.companyId), eq(toolConnections.id, connection.id)));
    const [g] = await db.select().from(connectionGrants).where(and(eq(connectionGrants.companyId, connection.companyId), eq(connectionGrants.id, grant.id)));
    if (!c || !g || !isGitHubAppConnection(c) || g.connectionId !== c.id || g.kind !== "agent" || !g.subjectAgentId
      || g.subjectAgentId !== grant.subjectAgentId || g.status !== "active" || (allowDraft ? c.status !== "draft" : (!c.enabled || c.status !== "active"))
      || JSON.stringify(c.config) !== JSON.stringify(connection.config) || JSON.stringify(g.credentialSecretRefs) !== JSON.stringify(grant.credentialSecretRefs)) githubAppFailure();
    if (!allowDraft) {
      const installs = await db.select().from(toolConnectionInstalls).where(and(eq(toolConnectionInstalls.companyId, c.companyId), eq(toolConnectionInstalls.connectionId, c.id)));
      if (!installs.some(i => (i.targetType === "agent" && i.targetId === g.subjectAgentId) || (i.targetType === "company" && i.targetId === c.companyId))) githubAppFailure();
    }
    return { c, g };
  };
  const { c, g } = await valid();
  const ref = g.credentialSecretRefs.find(r => r.configPath === GITHUB_APP_KEY_PATH);
  if (!ref) githubAppFailure();
  try {
    const secret = await resolveConnectionGrantSecret(db, c, g, ref, { actorType: "system", actorId: g.subjectAgentId ?? undefined, consumerType: "tool_connection", consumerId: c.id });
    const result = await client.acquire(`${c.companyId}:${c.id}:${g.id}:${secret.latestVersion}`, parseGitHubAppConfig(c.config.methodConfig), secret.value, force);
    await valid();
    return result;
  } catch (error) {
    rethrowGitHubAppFailure(error);
  }
}
