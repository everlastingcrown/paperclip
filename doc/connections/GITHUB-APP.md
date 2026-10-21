# Customer-owned GitHub App credentials

Use **GitHub → Customer-owned GitHub App** to give selected agents or all agents
an App's bot identity for managed Git, `gh`, and server-side repository checkout/fetch. Both public and
private GitHub.com App registrations use installation access tokens. This method
has no MCP tools and does not use GitHub's hosted MCP endpoint. The REST transport
is implemented by the GitHub repository credential adapter, not a generic REST
tool executor. Existing managed OAuth and PAT methods remain available.

## Setup

1. Register an App in [GitHub settings](https://github.com/settings/apps/new).
   Install it on the selected repositories. Webhooks and OAuth callbacks are not
   required for this method.
2. Grant the App the permissions required by a template below or your custom
   selection. Generate an RSA private key. Keep the App ID and installation ID (the number in the
   installation settings URL).
3. Open GitHub setup in Paperclip. If Paperclip enrollment or managed sign-in is
   unavailable, select **Connect to GitHub App** directly. Otherwise, under the
   connection method choices, select **Customer-owned GitHub App**. This method
   requires neither Paperclip Cloud enrollment nor authorization of the official
   Paperclip OAuth app. Choose personal or shared ownership, then select agents
   or allow all agents. Dedicated ownership remains available for one agent.
4. Enter the App ID or Client ID, installation ID, and explicit `owner/repository` list.
   Paste the complete PEM key, including its header, footer, and line breaks,
   into the masked multiline private-key field. Use **Show private key** only when
   you need to inspect it. Connecting automatically stores the key as an encrypted
   secret in the vault; no plaintext storage option is offered. Choose a permission
   template or **Custom permissions** and connect. On reconnect, leave the key
   blank to reuse the saved secret.
5. Paperclip verifies the App, installation, bot account, and repository access.
   Finish setup for the selected agent access. Failed verification leaves no working
   connection and cleans up the new credential using the normal setup rollback.

| Profile | Contents | Pull requests | Issues |
| --- | --- | --- | --- |
| Read | Read | Read | Read |
| Author | Write | Write | Read |
| Reviewer | Read | Write | Read |

All repositories must belong to the selected installation's account. The list
must contain 1–500 repositories. An empty list is denied. Paperclip sends explicit
repository and permission restrictions on every token request and never retries
with broader access. GitHub also enforces the installation's current access.
The templates do not request administration or workflow permissions.

Choose **Custom permissions** to enter a non-empty JSON object in **Custom
permissions (JSON)**. Use GitHub API permission names and `read`, `write`, or
`admin` levels, for example:

```json
{"contents":"read","pull_requests":"write","checks":"write"}
```

The custom map replaces the template; Paperclip does not add Contents, Pull
requests, or Issues grants. Choose the permissions needed for your Git/gh work.
GitHub implicitly includes repository metadata read access. Custom permissions
may include `workflows` or `administration` when explicitly selected and granted
by the installation. GitHub validates the supported names and levels; Paperclip
rejects malformed or empty maps and insufficient installation grants before
requesting a token. The map supports at most 100 entries and 10,000 characters.
Switching back to a template ignores the custom input. Custom scope stays fixed
on reconnect, just like a template; create a new connection to change it.

GitHub accepts either the numeric App ID or the Client ID as the JWT issuer.
Paperclip verifies the returned App identity and binds the installation to its
numeric App ID in both cases. See [GitHub's JWT documentation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app).
Connection failures identify the failed check using fixed guidance and a safe
`reason` code. Provider response bodies, PEM contents, JWTs, and tokens are never
included. A permissions failure requires approving the App's updated installation
permissions; changing only its registration is insufficient. Health checks and
catalog refreshes preserve `github_app_access_unavailable` and the allowlisted
`reason` in response details and audit records. Configuration and authentication
failures return HTTP 422; network failures return HTTP 502.

Fresh setup can reuse an archived GitHub OAuth or PAT connection with the same
name. Its old settings are not a GitHub App policy and must not be validated as
one. Existing GitHub App connections still preserve their App, installation,
repositories, and permission template or custom map on resume or reconnect.

The verified `app-slug[bot]` identity appears on the connection. Personal
connections use a user-owned key and are available when that owner is responsible
for the run, or through explicit standing delegation for ownerless work. Shared
connections use a company-owned key regardless of who starts the run. Both can
serve selected agents or all current and future agents. Ownership does not change
the provider bot identity. A dedicated identity takes
precedence over personal credentials. Disabled, revoked, missing, and ambiguous
assignments fail closed. Create **separate App registrations** for independent
author and reviewer bot identities; two installations of one App share its bot.

For shared and dedicated connections, company members (or the local trusted
board) can select the App's verified, explicitly configured repositories when creating or configuring a project.
Personal App repository metadata remains visible only to the credential owner.
Shared App metadata follows the saved human audience.
The project picker refreshes App access and shows connection failures through
its normal retry flow. Selecting a repository stores its identity and URL; it
does not grant other agents the App identity or repository access.

This identity is not proof of a human GitHub account. Personal repository reads
and skill-source setup do not gain access to an agent's App credentials. Managed
agent operations use the existing run identity and trust checks. Low-trust runs
cannot export raw credentials. Shell Git and `gh` are not constrained by
per-tool Ask-first controls; the installation token's scope is their limit.

## Configuration versions

The setup/API `configValues` form accepts an omitted version, string `"1"`, or
numeric `1`. Setup normalizes and stores the version as string `"1"`; unsupported
versions are rejected. The credential parser separately produces a runtime
configuration with numeric `version: 1`, a repository array, and resolved
permissions. That runtime object is not a setup/API form payload.

## Renewal, rotation, and removal

The PEM remains in Paperclip's encrypted vault: user-owned for personal
connections and company-owned for shared and dedicated connections. It is bound
to the exact connection grant and is never placed in agent instructions,
environment variables,
Git configuration, or provider request headers. Only a short-lived installation
token reaches the existing run/session credential broker.

Tokens and App JWTs live in process memory. Token caching is isolated by company,
connection, grant, key version, App, installation, repositories, and permissions.
Concurrent acquisition shares a request. Cache entries expire within five minutes
or one minute before the provider expiry, whichever comes first. Each acquisition
checks current connection state, grant, installation target, and vault ownership,
including on cache hits. A second check runs after provider acquisition.

Without webhooks, installation suspension, repository removal, and provider-side
key revocation are discovered on the next fresh acquisition (at most five minutes
of active use). The ordinary connection health sweep also checks App access.
GitHub may reject an already-issued token immediately when access changes.
Local disablement, grant revocation, and uninstall stop new acquisition immediately.
Already-exported tokens can remain usable until GitHub expires or revokes them;
clearing a local cache does not revoke tokens held by a running process.

Use **Reconnect** to replace the private key. The connection, ownership, agent
access, installation, repositories, and permissions stay fixed. Use Permissions
to change agent access. Changing ownership or App scope requires a new connection.
Removing a connection in Paperclip does not uninstall
the App from GitHub or delete its registration. Manage those in GitHub settings.

## Verification and current limits

Provider fixtures cover JWT signatures, scope narrowing, identity verification,
invalid responses, expiry, caching, and redacted errors. Authorization unit tests
cover disabled/revoked/reassigned/uninstalled access and revocation during
acquisition. These fixtures do not prove a live provider workflow.

Live acceptance remains required on a disposable repository: App A fetches,
pushes, and opens a PR; App B fetches its diff and submits an approval. Verify bot
attribution, denied repositories, rotation, renewal, and revoked assignment.
An approval does not prove branch protection or CODEOWNERS requirements are met.
GitHub Enterprise Server, automatic App creation, webhooks, and hosted MCP
installation-token authentication are outside this method.

## Connection names and removal

GitHub App setup in Connectors and Projects includes **Connection name**.
Choose a name to distinguish bot identities, and edit it when reconnecting.
Reconnect restores ownership and agent access, keeps the App and installation
policy fixed, and lets you keep the saved key by leaving its field blank.

After **Remove**, adding a connection starts a fresh GitHub App identity even
when the default name matches an archived connection. Its App, installation,
repositories, permission profile and assigned agent can all be chosen again.
The archived connection and its revoked grants remain separate history; they
are not silently revived with new credentials. Switching from a removed App to
a token connection is also supported. Explicit reconnect/resume links continue
the original connection and preserve its authority boundaries.

Fresh setup also leaves unfinished App drafts separate. Use an explicit resume
link to continue a saved draft; creating another connection does not inherit
that draft's policy or credentials merely because its name matches.
