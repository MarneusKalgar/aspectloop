# Dependency Security

Status: Active
Last updated: 2026-08-27

## Toolchain Contract

AspectLoop uses these repository-wide versions:

| Tool       | Contract                                             |
| ---------- | ---------------------------------------------------- |
| Node.js    | `24.19.0` selected through `.nvmrc`                  |
| npm        | `12.0.2` pinned through `packageManager`             |
| Node types | Node 24 major, installed through a human npm command |

Node `24.19.0` bundles npm `11.17.0`; npm `12.0.2` is an intentional independent
installation. M03-B CI and M03-C development containers must consume the same
exact pair.

The active shell must select Node `24.19.0` before invoking npm 12. If a legacy
machine-level `python` npm configuration exists, remove it outside the
repository before using the project's `strict-npmrc=true` policy:

```bash
cd ~
npm config delete python --location=user
```

Do not store machine-local npm configuration in the repository.

## M03-A Completion Baseline

M03-A completed on 2026-08-15 after human verification established this
baseline:

| Signal                 | Confirmed result                                                                |
| ---------------------- | ------------------------------------------------------------------------------- |
| Runtime contract       | Node `24.19.0`, npm `12.0.2`, and `@types/node@24.13.3`                         |
| Clean installation     | `npm ci` succeeds under the committed strict policy                             |
| Dependency tree        | `npm ls --all` succeeds with no invalid peer dependencies                       |
| Install scripts        | No installed package has an unreviewed lifecycle script                         |
| Dependency sources     | Repository policy accepts only registry packages and known root workspace links |
| Vulnerability audit    | Zero known vulnerabilities                                                      |
| Registry verification  | 1,053 package signatures and 239 provenance attestations verified               |
| Release-age exceptions | None                                                                            |

M03-B promotes the reproducible checks into pull-request CI. The `Quality` job
installs and asserts the exact toolchain, runs dependency policy directly
before `npm ci`, and then blocks on install-script coverage, high/critical audit
findings, deterministic verification, and builds. Registry signatures and
attestations run last with a two-minute timeout; they remain visible but
advisory until the GitHub-runner baseline is promoted. M03-C applies the same
exact Node/npm pair to development containers.

## Installation Policy

The committed `.npmrc` enforces:

- the supported Node/npm engine range;
- hard failure for unknown npm configuration keys;
- a three-day minimum package release age;
- denial of git, remote tarball, local tarball, and non-workspace directory
  dependency sources;
- hard failure when a dependency install script has no reviewed `allowScripts`
  decision.

Registry tarballs from the configured npm registry remain permitted.
`allow-directory=root` permits npm's root-workspace links while manifest and
lockfile policy checks reject arbitrary local directory dependency sources.

Do not set `ignore-scripts=true`. It would bypass the reviewed npm 12 lifecycle
policy and break packages that genuinely require platform setup. A human may
use a one-command `--ignore-scripts` override for a reviewed metadata-only npm
operation, but normal clean installation uses the committed allowlist.

## Install-Script Review

Dependencies cannot run `preinstall`, `install`, `postinstall`, or applicable
`prepare` scripts until npm-generated `allowScripts` metadata covers them.
Agents do not create or edit that field.

Use the current installed tree to list pending scripts:

```bash
npm run deps:scripts:pending
```

For the M03-A baseline, inspect the actual installed package scripts and their
purpose before recording these expected decisions:

| Package                | Expected decision     | Reason to verify                                                                 |
| ---------------------- | --------------------- | -------------------------------------------------------------------------------- |
| `esbuild@0.28.1`       | Approve exact version | Installs or validates the platform binary used by Vite/build tooling             |
| `fsevents@2.3.2`       | Approve exact version | Builds the optional macOS filesystem-watching binary used by development tooling |
| `fsevents@2.3.3`       | Approve exact version | Builds the optional macOS filesystem-watching binary used by development tooling |
| `@nestjs/core@11.1.19` | Deny by package name  | Current script emits sponsorship guidance rather than runtime setup              |
| `msw@2.14.6`           | Deny by package name  | Current script emits setup guidance; the tracked browser worker already exists   |

The human records decisions with npm commands:

```bash
npm install-scripts approve esbuild fsevents
npm install-scripts deny @nestjs/core msw
npm install-scripts ls
npm install-scripts prune --dry-run
```

Approval is version-pinned by npm 12 by default. Do not use `--all`,
`--dangerously-allow-all-scripts`, or an unpinned approval unless a separately
reviewed requirement documents why future versions can be trusted without
inspection.

A dependency update that changes an approved version must become uncovered and
fail until its new script is reviewed. Explicit denials remain blocked across
versions and should be revisited when package behavior changes materially.

## Repository Checks

Run these commands from the repository root after selecting the supported
Node/npm pair:

```bash
npm run deps:policy
npm run deps:scripts:pending
npm run deps:audit
npm run deps:signatures
```

`deps:policy` checks manifests and the lockfile for prohibited dependency
sources, verifies both committed and effective npm policy, and rejects
uncovered lifecycle scripts. Local use goes through the root npm script. CI
invokes the checker directly before dependency installation, after asserting
the exact npm version; direct invocation resolves that npm executable from
`PATH`. Its checker and required-configuration model live together under
`scripts/dependencies/`; they are handwritten quality infrastructure and remain
covered by root formatting and linting.

The effective-policy check reads only named security-sensitive keys. It rejects
higher-precedence environment, user, global, or command configuration that
enables unrestricted lifecycle scripts, non-registry dependency sources, force,
legacy peer resolution, or ignored scripts. It never reads or prints registry
credentials and does not execute dependency code or mutate files.

`deps:audit` reports vulnerabilities and exits unsuccessfully for high or
critical findings. M03-A closed with no known vulnerabilities. A future
remaining moderate/low finding requires an exposure assessment, owner, and
expiry.

`deps:signatures` uses `npm audit signatures` to inspect registry signatures
and supported provenance attestations. Coverage depends on package and registry
metadata. M03-B runs the check after required verification and builds, retains
its full output and job-summary outcome, and limits it to two minutes. It does
not initially fail the pull request on this signal. A human reviews the
reproducible GitHub-runner baseline before promoting it to blocking.

Never use:

- `npm audit fix --force`;
- `--legacy-peer-deps`;
- suppressive dependency `overrides` used only to hide an advisory;
- manual dependency, `allowScripts`, or lockfile edits.

For audit remediation, inspect `npm audit fix --dry-run --json`, prefer explicit
npm uninstall/install commands for direct dependency changes, and review all
manifest and lockfile churn before a clean `npm ci`.

## Temporary Compatibility Dependencies

The web workspace carries `ajv-formats@2.1.1` as a development-only
compatibility dependency. `@hookform/resolvers@5.7.1` publishes an optional
peer requirement for `ajv-formats@^2.1.1`, while the repository root resolves
`ajv-formats@3.0.1` for Angular and Nest build tooling. Installing the compatible
2.x peer in `apps/web` keeps `npm ls --all` valid without downgrading unrelated
root tooling.

AspectLoop uses the Zod resolver and does not use the AJV resolver at runtime.
This dependency therefore does not define an application capability and is not
an exception to the source, release-age, vulnerability, or install-script
policies.

| Package                                       | Owner        | Upstream reference                                                                         | Removal condition                                                                                                                                                                            |
| --------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web` dev dependency `ajv-formats@2.1.1` | Web/platform | [`react-hook-form/resolvers#814`](https://github.com/react-hook-form/resolvers/issues/814) | Remove through a human npm command after an eligible `@hookform/resolvers` release corrects its peer metadata, then confirm `npm ls --all` remains clean without the workspace-local package |

Do not upgrade this workspace-local package to 3.x while the installed resolver
declares `^2.1.1`. Reassess and remove the workaround whenever
`@hookform/resolvers` is upgraded.

## Release-Age Exceptions

A package published less than three days ago may be excluded only for an urgent
security fix or an owned package whose release is independently controlled.
Convenience and routine upgrades are not exceptions.

Every exception requires:

- the narrow package name placed in `min-release-age-exclude[]`;
- the blocked change or vulnerability being addressed;
- evidence that waiting creates greater risk;
- the owner and reviewer;
- the date added and an expiry no later than fourteen days later;
- a follow-up to remove the configuration entry and this record.

Active exceptions:

| Package | Reason and evidence | Owner/reviewer | Added | Expires | Removal follow-up |
| ------- | ------------------- | -------------- | ----- | ------- | ----------------- |
| None    | No active exception | N/A            | N/A   | N/A     | N/A               |

Never set `min-release-age=0` or remove the policy globally to unblock one
package.

## Renovate Operating Model

Hosted Renovate is the repository's only dependency-update PR bot. GitHub's
dependency graph and Dependabot alerts remain enabled, while Dependabot version
and security update PRs remain disabled to avoid duplicate proposals.

Renovate automates discovery, branch and lockfile preparation, release-note
collection, rebasing, and CI execution. It does not decide that an update is
semantically safe and it never authorizes a merge.

The retained policy is deliberately tiered:

- eligible patch and minor updates may create PRs automatically during the
  weekly Monday window;
- all major updates require explicit Dependency Dashboard approval;
- NestJS, GraphQL/code generation, persistence, messaging, identity, and the
  temporary React Hook Form/AJV compatibility pair require dashboard approval
  at every update level;
- the Playwright npm package and CI image are grouped and require coordinated
  human approval;
- exact Node/npm toolchain references and Dockerfile Roast references remain
  manual coordinated updates because each contract spans multiple files;
- npm releases must satisfy the same three-day quarantine as local installs;
- at most two Renovate branches and two Renovate PRs may exist concurrently;
- broad lockfile-maintenance PRs and automerge remain disabled.

The Dependency Dashboard is the update backlog. A Renovate PR represents an
update ready for evaluation, not a pre-approved change. Before merging, the
human maintainer reviews release and migration notes, peer and engine changes,
manifest/lockfile scope, lifecycle-script coverage, vulnerability impact, and
the deterministic CI result. Major updates normally receive a dedicated
migration PR or milestone rather than being treated as routine maintenance.

The initial npm 12 pilot PR updated the resolved ESLint version from `10.8.1`
to `10.9.0`. Renovate changed only the expected lockfile entry, the release was
older than the quarantine, and all configured PR checks passed. Final merge
authorization remained human-owned.

### Updater Exceptions

| Dependency                    | Automation | Owner    | Reason                                                                                                                                                                                                                         | Review condition                                                                                                                                                                               |
| ----------------------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node`                        | Manual     | Platform | The exact toolchain contract spans `.nvmrc`, root `packageManager`/`engines`, Docker `FROM` references, and Docker `NPM_VERSION`; a Dockerfile-only proposal could pass ordinary CI while local and container runtimes diverge | Update and review every toolchain surface as one change; reconsider automation only after a cross-file assertion enforces the same Node/npm contract in local, CI, and container configuration |
| `immanuwell/dockerfile-roast` | Manual     | Platform | Its SHA-pinned GitHub Action, workflow `image-tag`, and local `scripts/docker/check-policy.sh` image must move together; the GitHub Actions manager cannot safely update all three fields as one dependency                    | Reconsider when a narrowly scoped, reproducible manager can update all three values together or the action removes the separate runtime-image pin                                              |

The workflow's Dockerfile Roast version comment uses the upstream tag form
without a `v` prefix. Update the action SHA, workflow `image-tag`, and local
`DROAST_IMAGE` in `scripts/docker/check-policy.sh` as one unit. Do not approve
or create a bot PR that changes only a subset of those references.

## Dependency Change Workflow

1. Select Node `24.19.0` and npm `12.0.2`; remove unsupported user npm keys.
2. Human-initiated dependency changes use reviewed npm uninstall/install
   commands. Renovate may generate proposal branches under the operating model
   above. Never hand-edit dependency declarations, `allowScripts`, or
   `package-lock.json`.
3. Review and record every newly uncovered lifecycle script through npm's
   version-pinned approval or explicit denial command.
4. Run the dependency policy check and inspect the manifest and lockfile diff
   for new sources, scripts, peer changes, and unrelated churn.
5. Review the audit dry run before applying compatible fixes and isolate any
   behavior-changing major update.
6. Finish with a clean `npm ci`, dependency-tree inspection, policy check,
   lifecycle-script check, vulnerability audit, and registry-signature check.
