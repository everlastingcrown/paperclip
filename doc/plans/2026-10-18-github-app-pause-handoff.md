# GitHub App implementation — pause handoff

> **Current direction (2026-10-19):** PR [#1](https://github.com/everlastingcrown/paperclip/pull/1)
> and `backport/github-app-installation-auth-2026.1012.0` are the source of truth.
> The feature branch is retired after the comparison recorded below. Earlier
> instructions to maintain a separate feature branch are historical.

> Resumed on 2026-10-18. Release CI, production image build, disposable runtime
> smoke, and fork GHCR publication now pass. The public image and remaining
> acceptance limits are recorded in the final section below. Earlier pause and
> intermediate checkpoints are retained as history.

Paused at the user's request on 2026-10-18. Original requirements are in
`doc/plans/paperclip-github-app-implementation-handoff.md`; that user-provided
file remains untracked and untouched.

## Saved work

- Fork PR (draft): https://github.com/everlastingcrown/paperclip/pull/1
- Feature branch: `feat/github-app-installation-auth`, pushed through
  `fa8f1166ab2543987654d2d630a6802287ee2037`. Main workspace:
  `/home/spell/github/paperclip`.
- Backport: `backport/github-app-installation-auth-2026.1012.0`, pushed through
  `0f30a5aae9817a4529d9df3a02630cbe5b48fa7d`. Clean worktree:
  `/tmp/paperclip-github-app-backport` (recreate if `/tmp` disappears).
- Release base and PR base branch `test-base/v2026.1012.0` both resolve to
  `bba6a45f0d364cfd962ac59b3bdf2426a8222adb`.
- `origin` is `everlastingcrown/paperclip`; `upstream` is `paperclipai/paperclip`.
  No upstream PR, merge, registry publication, or live App operation was performed.

## Implementation

Added a customer-owned GitHub App method with a dedicated agent, vaulted PEM,
App/installation verification, explicit repositories, permission profiles, and
restricted installation tokens. It reuses managed Git/gh selection and existing
run/session brokers, with caching, renewal, authorization rechecks, key rotation,
redacted errors, and a guard against generic static credential export.

It uses a narrow repository credential adapter on **`rest_api`**, with **no MCP
tools**. `runtime_auth` cannot be used without changing database constraints.
No schema or migration history changed. Human repository pickers do not inherit
an agent's App grant. See `doc/connections/GITHUB-APP.md` for setup and limits.
Core code is in `server/src/services/github-app-{client,credentials}.ts`,
`git-credentials.ts`, `tool-access.ts`, shared definitions/validators/generator,
and the setup form's multiline PEM paste handler.

## Current build and evidence

https://github.com/everlastingcrown/paperclip/actions/runs/39081722908

At pause, release/database checks, dependency installation, focused tests, and
token gates passed. **Docker production build was still running.** It is left
running on GitHub; no successful image artifact has been confirmed.

On success, `.github/workflows/fork-github-app-image.yml` uploads an amd64 Docker
archive, checksum, resolved lockfile, and provenance for seven days. Extract the
artifact, check `SHA256SUMS`, then run
`docker load -i paperclip-github-app.tar.gz`. The run summary supplies the tag.
The workflow publishes nothing to a registry and stays out of the upstream PR.

70 focused tests passed on the newer feature checkout; the release's 66 focused
tests also pass on hosted Linux. Token/map checks and source syntax checks
passed. Full compilation, runtime/UI acceptance, database upgrade/rollback, and
live GitHub acceptance remain unverified. This is not upstream-ready.

Failures and fixes are recorded in the PR body:

- Release manifests/lockfile disagree: workflow resolves the lock in its build
  tree and includes it in the artifact. Do not commit `pnpm-lock.yaml`.
- Release-only catalog invariant fixed in `a52b035f4`.
- Hosted compiler found TS2352 in a partial test fixture; fixed in the latest
  commits above. Complete compilation/image result is still pending.
- Inherited review fails because dependency graph support is disabled. Other
  inherited CI uses today's upstream workflow and references scripts absent
  from this release. These checks must not be reported as green.

## Resume

1. Inspect the latest image run and fix its concrete failure, if any.
2. Test the artifact with a disposable release DB and matching encryption key.
3. Verify two separate Apps: author fetch/push/PR, reviewer diff/approval,
   distinct attribution, denied repositories, revocation, rotation, and renewal.
4. Complete broader acceptance, resolve the inherited CI mismatch, then rebase
   and prepare the separate feature branch for upstream submission.

**Resource constraint:** WSL crashed during earlier intensive checks. The user
requested small, sequential local checks and notification/stop on concerns or
blockers. Local Cargo is absent and Docker WSL integration is disabled. The user
chose GitHub Actions instead of local image builds; keep heavy work hosted.

## Resumed automated verification (2026-10-18)

The user resumed work and selected **automated checks only**. Do not perform
live App or repository operations as part of this continuation.

- The previously pending image run `39081722908` succeeded. It built the release
  production target and uploaded a 2,564,926,324-byte amd64 image artifact, ID
  `12119506990`, expiring 2026-10-25. This establishes a successful build, not
  runtime or live GitHub acceptance.
- Broader CI exposed ten feature-related failures that the narrow suites missed:
  three release reconnect fixtures omitted method selection, six setup-component
  cases defaulted to the new App method, and the intent suite expected only the
  token method. These were not solely inherited CI failures.
- Feature commit `29e35d251` restores the existing method order (`managed`,
  `mcp-key`, `app-installation`) and updates the intent expectations. It is pushed
  to the existing feature branch. The user-provided original handoff is untouched.
- The backport includes the same correction and explicit token-method selections
  in older reconnect fixtures. Commit `4a3120eae` adds the standard plugin SDK
  test-build prerequisite after run `39098507100` exposed its absence. That run
  passed all 66 focused tests, token gates, and the database-backed intent test,
  but did not reach image construction or the reconnect tests.
- At `4a3120eae`, the expanded hosted regression step passed before its image
  build was cancelled by the next push. This recovery does not erase the previous
  missing-prerequisite failure. The local feature checkout passed 34 catalog
  tests, all 199 setup-component tests, and token gates. Its embedded-PostgreSQL
  intent suite was skipped; do not count this as a local database pass.
- Backport head `3abaa75172abd3f4e86477eca8dbe0fae0244fb7` routes this fork PR's
  reusable CI workflow to release commit `bba6a45f0d364cfd962ac59b3bdf2426a8222adb`.
  Calling upstream `@master` had introduced commands absent from this release.
  The initial direct pin at `7d0d4d400` failed three workflow-policy assertions.
  The final caller preserves protected master for upstream and adds a separate
  release-pinned job restricted to this fork; it changes no policy tests. Hosted
  policy and Docker-context checks now pass. Local targeted workflow assertions
  pass; a full local shard test attempt failed its separate partition assertion
  (`0 !== 39`). No local whole-policy-suite pass is claimed.
  The pin and all image workflow changes remain out of the upstream feature branch.
- The image workflow now includes a separate hosted smoke job: verify checksums,
  load the archive, boot an isolated embedded database with a synthetic encryption
  key, create a company, restart, and verify persistence and UI HTML. It has no
  external network, published port, live App secrets, or model credentials.
  This is fresh-database/restart coverage, not upgrade/rollback or browser proof.
- The user enabled the fork's dependency graph. Dependency Review now passes.
  The enclosing `review` job still fails at `Generate commitperclip token` because
  the fork lacks `COMMITPERCLIP_KEY`. No current-head Greptile pass is established.
- Local Docker WSL integration remains unavailable. No local image build, large
  artifact download, Cargo installation, or production data access was attempted.

Current hosted runs (results pending when this checkpoint was written):

- Image plus disposable runtime smoke:
  https://github.com/everlastingcrown/paperclip/actions/runs/39099178019
- Release-pinned broader CI:
  https://github.com/everlastingcrown/paperclip/actions/runs/39099178368

Do not claim upstream readiness from the earlier image or focused test passes.

### Registry publication requested

The user subsequently requested a registry image usable in a Kubernetes pod and
selected **public GHCR with anonymous pulls**. This supersedes the earlier
no-registry-publication scope. Live App operations remain excluded.

Backport `ed1f9c182584c7b8f82c86a531be447b86f6d22b` adds a publication job gated on
the image smoke. It verifies the artifact checksum and source, loads that same
archive, and publishes only `ghcr.io/everlastingcrown/paperclip` with the
commit-specific release/App tag. It records the digest and uses the workflow's
package-write token. No upstream image namespace or stable tag is used.

- Current build, smoke, and publication:
  https://github.com/everlastingcrown/paperclip/actions/runs/39099761225
- Current release-pinned broader CI:
  https://github.com/everlastingcrown/paperclip/actions/runs/39099761595

The previous image run `39099178019` was cancelled by this authorized scope
change; no new successful image is claimed yet. Its broader CI finished 46 successful jobs, including Build, Typecheck + Release
Registry, all test lanes, and the previously failing feature lanes. Only Canary
Dry Run was cancelled; the overall run is cancelled, not green. GHCR creates new packages as private;
after publication, the account owner must set the package public in its settings.
Verify anonymous registry access before claiming it is ready for unauthenticated
Kubernetes pulls. No package visibility API or authenticated browser is available
in this session.

The release-pinned broader CI run `39099761595` is **successful** at
`ed1f9c182584c7b8f82c86a531be447b86f6d22b`. This includes typecheck, tests, build,
policy, Docker context, browser shards, and Canary Dry Run. The separate
commitperclip review job still fails for the missing fork bot credential.
The production image job in `39099761225` also passed and uploaded its archive;
runtime smoke and GHCR publication are still in progress.

### Final automated result and public Kubernetes image

All three jobs in image run `39099761225` succeeded: production build, disposable
boot/restart smoke, and GHCR publication. The saved health evidence reports
`status: ok`, version `2026.1012.0-github-app`, and source commit
`ed1f9c182584c7b8f82c86a531be447b86f6d22b`. Standard release CI run
`39099761595` is green at that same commit.

The account owner changed the package to public. Anonymous verification fetched
the exact manifest, matched its SHA-256 digest, and checked all 15 configuration
and layer blobs with HEAD requests. No saved Docker/GitHub credentials or full
local image download were used. This proves registry access; the runtime proof
is the hosted smoke, not an actual Kubernetes deployment.

Use this digest-pinned reference in the existing container definition:

```yaml
image: ghcr.io/everlastingcrown/paperclip@sha256:9d9b1291cbd78506e50239a02180bc4464bb6c19cefe0957b59c11c8ed954d36
```

- Platform: `linux/amd64`.
- Commit tag: `ghcr.io/everlastingcrown/paperclip:2026.1012.0-github-app-ed1f9c182584c7b8f82c86a531be447b86f6d22b`.
- Package: https://github.com/everlastingcrown/paperclip/pkgs/container/paperclip
- Registry-reference artifact: `github-app-registry-reference-ed1f9c182584c7b8f82c86a531be447b86f6d22b`
  in image run `39099761225` (30-day retention).
- Smoke evidence: `github-app-image-smoke-ed1f9c182584c7b8f82c86a531be447b86f6d22b`
  in the same run (7-day retention).
- Fork PR: https://github.com/everlastingcrown/paperclip/pull/1 (still draft).
- Feature source fix: `29e35d251`; release/backport head: `ed1f9c182`.

Remaining acceptance: live two-App operations, rotation/renewal/revocation against
GitHub, App-specific production UI journeys, release database upgrade/rollback,
and upstream rebase/review. These are not established by the fresh-database
smoke. Live App operations were explicitly excluded from this continuation.
The separate commitperclip review remains blocked on `COMMITPERCLIP_KEY`; no
current-head Greptile pass is established. No upstream PR or merge occurred.

### Local setup validation report (2026-10-18)

The published image's custom App form can submit an agent grant without
`subjectAgentId`. The API correctly rejects it with HTTP 400 and
`subjectAgentId is required exactly for an agent grant`. Switching from the
token method changes the grant kind to agent but retains the Any agent selection;
the owner picker is then hidden and the Connect button does not validate it.
This failure precedes App credential verification.

The feature workspace now forces specific-agent selection for dedicated grants,
shows the owner picker even if stale Any agent state remains, expands access
settings while the owner is missing, and blocks submission until exactly one
owner is selected. A component regression exercises method switching and checks
the submitted agent identity. Token gates passed; the regression could not run
because the checkout's Vitest dependency is missing (both root and UI invocation
failed). Typecheck, broader tests and build were not run. These edits are local,
uncommitted, and have not been backported or included in a new image.

For the current image, select Only agents I choose and one agent under the token
method before switching to Customer-owned GitHub App. The existing selection is
retained across the method switch. No live App verification was performed here.

### PR-hosted setup fixes (2026-10-18)

The operator confirmed that the owner-selection workaround resolves HTTP 400.
The next report used the Read profile with sufficient registered repository
permissions, but received the generic `github_app_access_unavailable` error.
Its failing check is not yet known. Do not infer a bad PEM or missing permission
from that response. GitHub supports App IDs and Client IDs as JWT issuers; the
existing numeric-only field also rejected Client IDs. The catalog's digit
patterns were over-escaped and have been replaced with explicit digit classes.

Backport commit `da20e9428cef6ae4002798d95fc05732c0599a8b` is pushed to existing
fork PR 1. It includes the owner fix, Client ID support with returned-App and
installation identity checks, corrected catalog patterns, and fixed diagnostic
messages/reason codes for the verification stages. Provider/crypto messages,
response bodies and credentials remain excluded. Tests cover Client ID matching,
safe failure stages, preservation through vault resolution and method switching.
The previous local-only checkpoint above is superseded by this PR push.

The user explicitly requested hosted PR tests because device space is limited.
No dependency install, local test suite, build, Docker run or artifact download
was performed for this revision. The backport checkout is sparse (under 1 MiB).

- Hosted image and focused tests: https://github.com/everlastingcrown/paperclip/actions/runs/39120235651
- Hosted release CI: https://github.com/everlastingcrown/paperclip/actions/runs/39120236168

Both are pending at this checkpoint. The published `ed1f9c182` image and its green
checks above do not validate this revision. No new working image or successful
live App authentication is claimed. No upstream PR or merge occurred.

### Paused for local environment repair (2026-10-18)

The user requested that work stop after this handoff update while they restore
the local development environment. Do not resume validation or implementation
until the user resumes work.

- Feature source: `4c61ceb6c`, pushed to `origin/feat/github-app-installation-auth`.
- Release PR source: `da20e9428cef6ae4002798d95fc05732c0599a8b`, pushed to
  `origin/backport/github-app-installation-auth-2026.1012.0` in
  https://github.com/everlastingcrown/paperclip/pull/1.
- The image workflow's focused-check step was still running at the last check.
  Release CI was pending. Runs `39120235651` and `39120236168` above remain
  running/queued independently; they were not cancelled. Inspect their actual
  results when work resumes. Do not count this checkpoint as a pass.
- A separate current-head commitperclip review failed. Earlier runs failed for
  the missing fork bot credential; this latest failure's log has not been read.
- The operator confirmed installed permissions: Actions, Checks, Issues and
  Metadata read; Code/Contents, Pull requests and Workflows read/write. These
  satisfy the chosen Read profile. No permission broadening is indicated.
- Current numeric-App-ID authentication still has no established cause. Client
  ID support and diagnostic improvements are implemented but unverified.
- No local dependencies were installed, tests/builds run, or images downloaded
  during this continuation. The earlier failed Vitest attempts remain recorded.
- Release checkout: `/tmp/paperclip-github-app-backport`, sparse, under 1 MiB,
  with only affected files. It has no installed dependencies. Do not assume it
  can run tests without restoring a complete development checkout.
- The operator's original `doc/plans/paperclip-github-app-implementation-handoff.md`
  remains untracked and untouched.

On resume, inspect hosted failures first and repair any regressions before
claiming the revision works. Confirm the rebuilt image's source SHA/digest if
publication succeeds; the only established public image remains the older
`ed1f9c182` digest recorded above. Then use the restored local environment to
validate the real setup journey. Never request or print the operator's PEM,
JWTs, or tokens. Live provider writes still require explicit scope.

### Resumed local verification and PR repair (2026-10-18)

The user resumed work and confirmed that local memory/storage are no longer a
constraint. Local shell execution, dependency installation, tests, typecheck,
and UI build now work. Network and Git metadata operations require the executor's
approved escalation path; that path works. The cloud runtime status tool and
`/etc/codex/network-policy.json` are unavailable in this executor.

- Image run `39120235651` failed before image construction. Release CI
  `39120236168` failed UI tests and UI typecheck. All three failures identify the
  missing `customerOwnedApp` helper in the backported owner-selection regression.
  The latest review failure was also inspected: it still lacks
  `COMMITPERCLIP_KEY`. There are no PR review or general comments.
- Backport `dc65d661f` removed the missing helper reference and was pushed. Local
  execution then exposed another fixture error: omitting managed methods opens
  the enrollment/error screen before the test can switch methods. A token-method
  URL alone did not bypass that screen. Changing the enrollment response alone
  also did not reach the method picker. These failed attempts are not acceptance
  passes.
- Backport `322a3cc63e435e81e0de5470a9f0b80d1b3159c1` uses the existing
  managed-capable gallery fixture and explicitly selects `method=mcp-key` before
  switching to the App. The test proves Connect stays blocked until an owner is
  selected and that the request includes that agent. The same fixture correction
  is applied to the feature checkout. No runtime implementation changed in this
  repair.
- Restored a complete release worktree at `/tmp/paperclip-github-app-backport` and
  installed dependencies. `corepack pnpm` uses Node `24.15.0` and pnpm `9.15.4`.
  The standalone `pnpm` command instead launches Node 20; use Corepack for this
  checkout. Initial sandboxed dependency resolution failed DNS; the approved
  network path succeeded. A test command issued before installation completed
  could not find Vitest; subsequent commands ran after installation finished.
  The locally resolved release lockfile is intentionally uncommitted.
- Local release results: all **192 setup-component tests**, all **76 focused
  provider/authorization/catalog tests**, **four selected database-backed
  intent/reconnect tests**, UI typecheck, UI production build, plugin SDK build
  prerequisites, token gates, and diff whitespace checks pass. The server command
  skips 389 unrelated cases. This is not a full local server or repository pass.
  These tests use synthetic credentials and disposable PostgreSQL, with mocked
  provider responses. They establish no live App authentication.
- The feature checkout also installed successfully with its unchanged frozen
  lockfile. Its **200 setup-component tests**, **80 focused provider/catalog
  tests**, UI typecheck, UI production build, plugin SDK prerequisites, and token
  gates pass locally on Node 24.15.0 and Vitest 5.0.3. The release uses Vitest
  4.1.11. These results were obtained independently in each checkout.
- Current image/smoke/publication:
  https://github.com/everlastingcrown/paperclip/actions/runs/39121344941
- Current broader release CI:
  https://github.com/everlastingcrown/paperclip/actions/runs/39121345312
- Current review blocker:
  https://github.com/everlastingcrown/paperclip/actions/runs/39121343378
  fails token generation because `COMMITPERCLIP_KEY` is missing. No current-head
  Greptile pass is established. Do not remove this gate or invent a bot key.

Hosted results above are pending at this checkpoint. No new accepted image or
digest is claimed. Full local repository typecheck/tests/build were not run;
broader qualification remains hosted, and local Cargo is still absent. The UI
production build passes with existing chunk-size/dynamic-import warnings. The
operator's original untracked handoff remains untouched. Live App operations,
database upgrade/rollback, upstream readiness, and the new image's runtime
acceptance remain unverified.


### Canonical backport consolidation (2026-10-19)

The user chose the release backport as the only active implementation branch.
Continue changes in `backport/github-app-installation-auth-2026.1012.0` and PR 1.
Do not recreate or synchronize a separate feature branch for this work.

Compared feature tip `3b5f263eaf5e7d443ab5a04f03079857593611b8` (base
`27ab902d3`) with backport tip `322a3cc63e435e81e0de5470a9f0b80d1b3159c1`
(base `bba6a45f0`). `git range-diff` and per-file changes against each base show:

- The App client, credential resolver, authorization tests, and managed Git
  integration are identical between the tips.
- The GitHub catalog, ingestion changes, setup owner validation, PEM paste
  handling, intent expectation, and corrected owner-selection regression contain
  the same feature changes.
- Shared types and validators retain their release-base context and the same
  App exchange contract. The tool-access adaptation omits unrelated Daytona
  support that is absent from the release. Backport-only reconnect fixtures,
  catalog assertion, release CI, and image publication remain intact.
- The release uses `feature-map/connection-setup.md` rather than the newer
  `maps/` layout. Its setup entry and `doc/connections/GITHUB-APP.md` retain the
  credential scope and access limits documented in the feature's maps.
- The feature-only handoff and verification history are preserved above.
  The original untracked implementation handoff remains untouched.

No runtime or test source changes were needed for consolidation. The feature tip
is saved in a local Git bundle at
`.git/branch-archives/github-app-feature-3b5f263ea.bundle` before removal of its
local and origin branch refs. This retains the original history without another
active branch. Restore with `git fetch <bundle-path>
refs/heads/feat/github-app-installation-auth:refs/heads/feat/github-app-installation-auth`.

Hosted results have now completed for runtime source `322a3cc63`:

- Release CI [39121345312](https://github.com/everlastingcrown/paperclip/actions/runs/39121345312)
  passed, including typecheck, tests, build, and the release verification lanes.
- Image build, disposable boot/restart, and GHCR publication
  [39121344941](https://github.com/everlastingcrown/paperclip/actions/runs/39121344941)
  all passed. The small registry-reference artifact records source
  `322a3cc63e435e81e0de5470a9f0b80d1b3159c1`, platform `linux/amd64`, and image
  `ghcr.io/everlastingcrown/paperclip@sha256:ca5b6dfa167e18a10c5e446dac18879ef7b91c8ab00f8310daef4ff03109437f`.
  This supersedes the older image recorded above. No Kubernetes deployment or
  fresh anonymous-pull check was performed during consolidation.
- Review [39121343378](https://github.com/everlastingcrown/paperclip/actions/runs/39121343378)
  still fails because `COMMITPERCLIP_KEY` is absent. There is no Greptile check
  tied to this head. PR 1 stays draft; no merge-readiness claim is made.

The consolidation changes documentation only. The preceding hosted results apply
exactly to its unchanged runtime tree, not to a new image built from the docs
commit. Full local typecheck, tests, and build were not repeated for this docs-only
change. Earlier material failures remain recorded above. Live two-App acceptance
and existing-database upgrade/rollback remain unverified.
