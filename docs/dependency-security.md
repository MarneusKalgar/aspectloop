# Dependency Security

Status: Active
Last updated: 2026-08-15

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
| Install scripts        | No installed package has an unreviewed lifecycle script                         |
| Dependency sources     | Repository policy accepts only registry packages and known root workspace links |
| Vulnerability audit    | Zero known vulnerabilities                                                      |
| Registry verification  | 1,053 package signatures and 239 provenance attestations verified               |
| Release-age exceptions | None                                                                            |

M03-B promotes the reproducible checks into pull-request CI. M03-C applies the
same exact Node/npm pair to development containers.

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
sources, verifies the committed npm policy, and rejects uncovered lifecycle
scripts. It does not execute dependency code or mutate files.

`deps:audit` reports vulnerabilities and exits unsuccessfully for high or
critical findings. M03-A closed with no known vulnerabilities. A future
remaining moderate/low finding requires an exposure assessment, owner, and
expiry.

`deps:signatures` uses `npm audit signatures` to inspect registry signatures
and supported provenance attestations. Coverage depends on package and registry
metadata, so the first reproducible baseline is human-reviewed before M03-B
makes the check blocking in CI.

Never automate or use:

- `npm audit fix --force`;
- `--legacy-peer-deps`;
- suppressive dependency `overrides` used only to hide an advisory;
- manual dependency, `allowScripts`, or lockfile edits.

For audit remediation, inspect `npm audit fix --dry-run --json`, prefer explicit
npm uninstall/install commands for direct dependency changes, and review all
manifest and lockfile churn before a clean `npm ci`.

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

## Dependency Change Workflow

1. Select Node `24.19.0` and npm `12.0.2`; remove unsupported user npm keys.
2. Mutate dependencies only through reviewed npm uninstall/install commands;
   never hand-edit dependency declarations, `allowScripts`, or
   `package-lock.json`.
3. Review and record every newly uncovered lifecycle script through npm's
   version-pinned approval or explicit denial command.
4. Run the dependency policy check and inspect the manifest and lockfile diff
   for new sources, scripts, peer changes, and unrelated churn.
5. Review the audit dry run before applying compatible fixes and isolate any
   behavior-changing major update.
6. Finish with a clean `npm ci`, dependency-tree inspection, policy check,
   lifecycle-script check, vulnerability audit, and registry-signature check.
