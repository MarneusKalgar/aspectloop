# Branch Governance

Status: Active
Last updated: 2026-08-19

## Integration Model

`main` is AspectLoop's only permanent integration branch. Feature and
maintenance branches enter `main` through pull requests.

The repository does not maintain permanent `development`, `release/*`, or
production branches. A branch name does not represent an environment.

M11 may introduce a manually dispatched stage deployment workflow with an
explicit source-ref input that defaults to `main`. That workflow remains a
separate deployment concern and does not change the integration model.

## Pull Request Contract

Pull requests target `main` and should remain reviewable as one bounded change.
The author records scope, risk, generated artifacts or migrations, human
verification, and residual limitations.

M03-B provides deterministic pull-request checks in
`.github/workflows/pr-checks.yml`. After the workflow has run at least once and
GitHub has registered its names, branch protection uses `All Checks Passed` as
the single required aggregate status. Independent jobs remain visible for
diagnosis, but branch rules depend on the stable aggregate rather than every
implementation-specific job name.

The required workflow must use `pull_request`, never `pull_request_target`, for
repository code. Pull-request jobs receive read-only repository permission and
no deployment credentials or environment secrets.

## Pull Request Checks

The `PR Checks` workflow runs for pull requests targeting `main`, pushes to
`main`, and manual diagnostic dispatches. Superseded runs for the same pull
request or ref are cancelled.

| Check               | Responsibility                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `Quality`           | Exact toolchain, clean lockfile install, dependency policy, audit/signature evidence, deterministic verification, and workspace builds |
| `Web E2E Scope`     | Fixed-path decision that requires or intentionally skips the mocked browser workflow                                                   |
| `Mocked Web E2E`    | Lockfile-matched Playwright container and the real Vite UI against browser MSW when required                                           |
| `Docker Policy`     | Reusable, path-aware Compose validation and development-image builds                                                                   |
| `All Checks Passed` | Stable aggregate that validates required outcomes and explicitly authorized skips                                                      |

Every trust-isolated application-check job performs its own `npm ci`; only
npm's download cache is shared through `setup-node`. Actions and external
containers are pinned to reviewed immutable references, job timeouts are
bounded, and Playwright failure artifacts expire after three days.

Mocked web E2E is required for `apps/web/**`, root toolchain/dependency inputs,
the owning workflow, and the fixed CI change-detector files. Backend-only and
documentation-only changes complete the scope job and intentionally skip the
heavy browser job. The aggregate sentinel accepts that skip only when the scope
output is exactly `false`; a required, cancelled, failed, or unexpectedly
skipped browser job fails the merge gate. Manual dispatch can force the browser
workflow with `run_web_e2e`.

Web-relevant runs use the exact Playwright version resolved by the lockfile and
the matching digest-pinned Noble image. The job asserts the package/image
version contract and does not run host `apt` or download a browser at runtime.

The Docker job is isolated in
`.github/workflows/reusable-docker-policy.yml` and reports a successful
intentional skip when no Docker-owned path changed. During M03-B it validates
Compose and the relevant development images. M03-C task 10.7 owns
`droast.toml`, the pinned Dockerfile Roast integration, and the final blocking
Docker policy; the M03-B job rejects a Roast configuration that appears without
its execution step so that policy cannot be mistakenly bypassed.

## Workflow Implementation Conventions

Workflow YAML defines orchestration and security boundaries: triggers,
permissions, concurrency, jobs, conditions, action calls, timeouts, artifacts,
and bounded job summaries. Keep short, linear shell commands inline when their
behavior remains obvious from the workflow.

Move branching, GitHub event or JSON parsing, reusable policy, and other
substantial implementation logic into fixed-purpose `scripts/ci/*.mjs` files.
Use Node only after the workflow has selected an explicit runtime. CI scripts
must invoke child processes with argument arrays rather than a shell, consume
repository-defined configuration, validate named modes, and reject arbitrary
commands or path lists from workflow input. Agent-authored functions and
methods remain subject to the repository JSDoc rule.

Use a reusable workflow when a complete job has its own ownership boundary,
runner, timeout, permissions, and diagnostic lifecycle. Use a local composite
action only for a genuinely repeated step sequence, normally after a third job
needs the same complete sequence. Do not introduce either abstraction only to
reduce the caller workflow's line count; the objective is clearer ownership,
not fewer total lines.

Every called workflow preserves or reduces the caller's permissions and
receives no inherited secrets unless a reviewed requirement explicitly needs
them. External actions remain pinned to reviewed full commit SHAs with version
comments, including actions called from reusable workflows or future composite
actions.

Current dependency, Docker, and web E2E path classification uses fixed groups
under `scripts/ci/`. Node/npm bootstrap steps remain explicit while only
`Quality` and `Mocked Web E2E` share the complete contract; reconsider a local
composite action when a third job adopts it.

Registry-signature verification is visible but advisory until its first GitHub
runner baseline is reviewed. Dependency policy, install-script coverage, and
the classified high/critical audit baseline are blocking.

## Expected Main Rules

Configure these rules after the committed workflow successfully runs and
GitHub registers its check names:

- require a pull request before merging;
- require `All Checks Passed` and require the branch to be current where the
  repository plan supports it;
- require review conversations to be resolved;
- block force pushes and deletion of `main`;
- do not grant pull-request workflows write, package, OIDC, environment, or
  deployment permission;
- do not allow an AI reviewer to satisfy a human approval rule.

AspectLoop currently has one maintainer. Branch rules therefore do not require
an unavailable second-human approval. The maintainer may merge after required
checks pass, the diff and AI findings have been independently reviewed, and all
material conversations are resolved. Deterministic checks remain mandatory.
The three-layer local and GitHub workflow, including AI finding validation, is
defined in `docs/review-process.md`.

## Retiring Development

The legacy remote `development` branch may be deleted only after a human
confirms that no open pull request targets it and that it contains no unique
work that should be retained. Do not rewrite history or force-update `main`.

After that check, the human may remove the remote branch and any stale local
tracking reference. Historical feature branches can be deleted independently
when their work is already reachable from `main`.

## Emergency Changes

An urgent fix still uses a pull request and the required deterministic checks.
If GitHub itself prevents the required workflow from running, document the
incident and temporarily change only the unavailable rule. Restore the rule as
soon as the workflow is healthy. Never bypass a failing product or security
check merely because the change is urgent.
