# Customer-owned GitHub App credentials

Use **GitHub → Customer-owned GitHub App** to give one agent an App's bot identity
for managed Git, `gh`, and server-side repository checkout/fetch. Both public and
private GitHub.com App registrations use installation access tokens. This method
has no MCP tools and does not use GitHub's hosted MCP endpoint. The REST transport
is implemented by the GitHub repository credential adapter, not a generic REST
tool executor. Existing managed OAuth and PAT methods remain available.

## Setup

1. Register an App in [GitHub settings](https://github.com/settings/apps/new).
   Install it on the selected repositories. Webhooks and OAuth callbacks are not
   required for this method.
2. Grant the App the permissions required by the profile below. Generate an RSA
   private key. Keep the App ID and installation ID (the number in the
   installation settings URL).
3. Open GitHub setup in Paperclip. If Paperclip enrollment or managed sign-in is
   unavailable, select **Connect to GitHub App** directly. Otherwise, under the
   connection method choices, select **Customer-owned GitHub App**. This method
   requires neither Paperclip Cloud enrollment nor authorization of the official
   Paperclip OAuth app. Choose the agent that owns the bot identity.
4. Enter the App ID or Client ID, installation ID, and explicit `owner/repository` list.
   Paste the complete PEM key, including its header, footer, and line breaks,
   into the multiline private-key field. Choose a permission profile and connect.
5. Paperclip verifies the App, installation, bot account, and repository access.
   Finish setup for the selected agent. Failed verification leaves no working
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
Administration and workflow permissions are not requested.

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
repositories, and permission profile on resume or reconnect.

The verified `app-slug[bot]` identity appears on the connection. It acts for this
agent regardless of the person who starts a task. A dedicated identity takes
precedence over personal credentials. Disabled, revoked, missing, and ambiguous
assignments fail closed. Create **separate App registrations** for independent
author and reviewer bot identities; two installations of one App share its bot.

Company members (or the local trusted board) can select the App's verified,
explicitly configured repositories when creating or configuring a project.
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

The PEM remains in Paperclip's encrypted company vault. It is bound to the exact
dedicated grant and is never placed in agent instructions, environment variables,
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

Use **Reconnect** to replace the private key. The connection, assigned agent,
installation, repositories, and permissions stay fixed. Changing those choices
requires a new connection. Removing a connection in Paperclip does not uninstall
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

## Release backport and local image

The requested release base is `v2026.1012.0`
(`bba6a45f0d364cfd962ac59b3bdf2426a8222adb`). The feature uses existing JSON,
grants, and vault references and changes no database schema, migrations,
snapshots, journal, or migration runner. Continue this fork's work on
`backport/github-app-installation-auth-2026.1012.0`, the source of truth for
[PR #1](https://github.com/everlastingcrown/paperclip/pull/1). The former
`feat/github-app-installation-auth` branch is retired. Do not run a newer
upstream checkout against a release database merely to try this feature.

From the backport checkout, build with the release's own Dockerfile:

```sh
docker build --target production --progress=plain -t paperclip:2026.1012.0-github-app .
```

Use your existing local deployment configuration with that image and a disposable
copy of your release database and matching encryption key. The fork image is
published for testing. Do not treat the branch as upstream-ready until typecheck,
tests, build, release database compatibility, and live acceptance pass. Run large checks and
Docker builds one at a time on a machine with sufficient resources. A Docker
Desktop installation must enable WSL integration for the build distro.

For this fork, the draft PR against `test-base/v2026.1012.0` runs
**Fork GitHub App test image**. The workflow checks the exact PR commit, verifies
that database files are unchanged, runs focused tests, and builds the release
production Docker target on hosted Linux. It uploads an amd64 Docker archive,
checksum, resolved lockfile, and source provenance for seven days. A disposable
boot/restart smoke test gates publication of the same archive to
`ghcr.io/everlastingcrown/paperclip`. The workflow records the source commit,
commit-specific tag, immutable digest, and platform in a registry-reference
artifact retained for 30 days. Use its digest reference for Kubernetes testing.
Alternatively, download the Docker archive, check `SHA256SUMS`, and run
`docker load -i paperclip-github-app.tar.gz`.
The build, smoke test, and publication passed for source `322a3cc63` in
[run 39121344941](https://github.com/everlastingcrown/paperclip/actions/runs/39121344941).
This is image startup evidence; live App authentication and release database
upgrade/rollback remain unverified.
The release tag has a manifest/lockfile mismatch, so the workflow resolves the
lockfile in its disposable build tree before frozen installation. It includes
that exact resolved lockfile in the artifact; no lockfile change is committed.
The workflow and its test config are fork-specific. Any future upstream
contribution must omit them and be rebased and verified separately. See the
[consolidated handoff](../plans/2026-10-18-github-app-pause-handoff.md) for the
comparison and verification history.
