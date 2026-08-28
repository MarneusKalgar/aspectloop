# AspectLoop Review Process

Status: Active  
Last updated: 2026-08-27

## Table Of Contents

- [1. Purpose](#1-purpose)
- [2. Review Layers](#2-review-layers)
- [3. Review Scope](#3-review-scope)
- [4. Change Classification](#4-change-classification)
- [5. Specialist Routing](#5-specialist-routing)
- [6. Review Priorities](#6-review-priorities)
- [7. Required Review Output](#7-required-review-output)
- [8. Human Validation And Merge](#8-human-validation-and-merge)
- [9. Review Boundaries](#9-review-boundaries)

## 1. Purpose

AspectLoop uses one review process across local verification, local AI review,
and GitHub pull requests. Deterministic checks establish reproducible evidence;
AI review looks for defects and risks that those checks do not prove; the human
maintainer owns the final judgment.

AI review is advisory. It does not replace deterministic checks, authorize a
merge, satisfy a human approval rule, or grant permission to modify code.

## 2. Review Layers

### 2.1 Human Local Verification

The author runs the commands relevant to the changed surface and records the
actual results. The normal repository baselines are:

```bash
npm run verify
npm run verify:full
```

Local-stack checks, migrations, generated artifacts, and focused commands are
added when the change requires them. `AGENTS.md` defines these commands as
human-owned: an agent reports what was not run and never implies success.

### 2.2 Read-Only Local AI Review

Use a fresh review task for security-sensitive, cross-boundary, or otherwise
risky changes so implementation context does not bias the review. Invoke the
repository skill when available:

```text
Use $aspectloop-code-review to review this branch against origin/main.
```

The reviewer inspects the diff and repository instructions first, selects only
the relevant specialist guidance, and returns one normalized report. A review
request does not authorize edits, GitHub mutations, or verification commands.

### 2.3 GitHub Pull-Request Review

Push the understood diff and complete the pull-request template. GitHub CI
provides the deterministic merge signal through `All Checks Passed`. Local or
GitHub AI findings are independently validated against the code and expected
behavior before they are accepted, fixed, or rejected.

When Codex GitHub review is available, use the configured automatic review or
an explicit `@codex review` request. Its comments remain advisory and follow the
same independent-validation rule as a local review.

Greptile is currently a repository-scoped, non-blocking evaluation. It is not a
required status check and does not replace the local review router, deterministic
verification, or human approval. The initial Renovate-configuration review
produced an accurate summary and no actionable finding, but that single
configuration-only PR is not representative evidence. Retain/remove evaluation
continues across frontend, backend/GraphQL, Docker/CI, and cross-boundary PRs;
revoke access if the trial becomes paid beyond the accepted budget or the
validated signal does not justify its permissions and review noise.

Merge only when required checks pass, material conversations are resolved, and
the maintainer accepts the recorded residual risk.

## 3. Review Scope

### 3.1 Prepare An Up-To-Date Base

The human may refresh the remote base before starting the review:

```bash
git fetch --prune origin main
```

An AI reviewer does not fetch or otherwise mutate Git state unless explicitly
asked. It uses the available base and reports when `origin/main` may be stale.

### 3.2 Establish The Merge Base

For the normal feature-branch review:

```bash
BASE_REF=origin/main
MERGE_BASE=$(git merge-base "$BASE_REF" HEAD)
git status --short
git diff --name-status "$MERGE_BASE"
git diff --stat "$MERGE_BASE"
git diff --find-renames "$MERGE_BASE"
```

The final command compares the merge base with the current index and working
tree. This includes committed, staged, and unstaged changes, but not untracked
file contents. Inspect every untracked file reported by `git status` separately.

To review only the committed branch or the exact local equivalent of a PR diff:

```bash
git diff --find-renames "$MERGE_BASE" HEAD
```

If the user supplies another base, commit range, PR, or explicit file list, use
that scope and state it in the report. Do not silently expand a focused review
to unrelated repository code.

## 4. Change Classification

Classify paths before loading specialist guidance. A file may belong to more
than one risk surface, but the final report covers each underlying problem once.

- **Shared source/config:** `packages/**`, root TypeScript/tool configuration,
  and shared runtime utilities. Review dependency direction, compatibility,
  type safety, and affected consumers.
- **Frontend:** `apps/web/**`, Storybook, Vite, MSW, and Playwright. Review React
  behavior, state, accessibility, browser security, and test realism.
- **Backend:** `apps/gateway-api/**`, `apps/extraction-service/**`,
  `apps/correction-service/**`, `mocks/**`, and backend packages. Review NestJS
  boundaries, DI, validation, error handling, and service ownership.
- **GraphQL/contracts:** gateway SDL and generated definitions, web
  operations/codegen, and `packages/contracts/**`. Review compatibility,
  nullability, transport/domain separation, and generated drift.
- **Database/migrations:** entities, datasources, repositories, `migrations/**`,
  and seeds. Review ownership, constraints, transaction safety, and migration
  implications.
- **Docker/CI:** Dockerfiles, Compose, `.github/**`, `.dockerignore`, `.npmrc`,
  and CI/dependency scripts. Review reproducibility, least privilege, immutable
  dependencies, and bounded jobs.
- **Security/auth:** authentication, authorization, cookies/tokens, secrets,
  uploads, user input, and logging. Review broken access control, disclosure,
  injection, and unsafe defaults.
- **Documentation:** `README.md`, `docs/**`, plans, and ADRs. Review contract
  accuracy, stale commands, contradictions, and missing operational effects.

Review cross-boundary effects explicitly. Examples include an SDL change without
updated web artifacts, an entity change without a human-generated migration, a
new endpoint without authorization, or a workflow change that weakens the
aggregate merge gate.

## 5. Specialist Routing

The repository router at `.agents/skills/aspectloop-code-review/SKILL.md` owns
selection. The repository contract is self-contained and does not require any
machine-local specialist. Classify the needed capability first, then inspect
the skills actually available in the current agent environment. Load only a
compatible match:

- React or browser review. Optional known matches: `frontend-code-review` and,
  for rendered semantics or interaction, `accessibility`.
- NestJS architecture and implementation review. Optional known match:
  `nestjs-best-practices`.
- GraphQL public-contract review. Optional known match: `graphql-schema`.
- Apollo client operations, hooks, cache, or code-generation review. Optional
  known match: `apollo-client`.
- Authentication lifecycle and authorization review. Optional known matches:
  `auth-implementation-patterns` and, for vulnerability analysis,
  `security-review`.
- Sensitive-input, secret, upload, or disclosure review. Optional known matches:
  `security-review` and, for credential exposure, `secret-scanner`.
- PostgreSQL and migration-safety review. Optional known matches:
  `postgresql-code-review` and `database-migrations`.
- Dockerfile or Compose review. Optional known match: `docker-expert`.
- GitHub Actions and delivery-flow review. Optional known match: `cicd-expert`;
  supply-chain, secrets, OIDC, signing, or provenance review may additionally
  match `ci-cd`.
- Playwright E2E review. Optional known match: `e2e-testing`.
- General source readability review when no narrower capability owns the diff.
  Optional known match: `coding-standards`.

Exact names are examples, not dependencies. Do not install a missing specialist
or fail the review because none is available. Apply this document's core review
contract directly and disclose the reduced specialization when it materially
limits confidence.

Do not load every available skill. Inspect a candidate's declared language,
framework, path, and task boundaries before using it; for example, a Python-only
backend reviewer is not a compatible NestJS TypeScript reviewer.

Specialist output formats are inputs to the repository review, not the final
response format. Normalize overlapping findings and apply AspectLoop's severity
and evidence rules below.

## 6. Review Priorities

- **P0 Critical:** credible security compromise, destructive data loss, secret
  exposure, or a change that must not merge under any expected use.
- **P1 High:** likely user-visible failure, broken authorization or contract,
  migration/release blocker, or material regression on a supported path.
- **P2 Medium:** real defect or reliability/maintainability risk with bounded
  impact that should normally be corrected before or immediately after merge.
- **P3 Low:** concrete improvement with limited impact. Do not report subjective
  style preferences or speculative future abstractions as findings.

Findings must be actionable and supported by the changed code or a directly
affected contract. Ask an open question when evidence is insufficient instead
of presenting speculation as a defect.

## 7. Required Review Output

Use this order:

1. **Findings**, highest priority first. Each finding includes priority, concise
   title, current file and line evidence, impact, and a bounded fix direction.
2. **Open Questions / Assumptions**, only where answers may change the review.
3. **Verification Observed**, separating author/CI-reported results from checks
   not run by the reviewer.
4. **Residual Risk**, including unreviewed surfaces, generated artifacts,
   migration implications, and limits of static inspection.

When no actionable issue is found, state `No findings identified.` and still
report verification gaps and residual risk. Do not manufacture a low-priority
finding to avoid an empty result.

Use current file line references rather than diff hunk positions. Keep one
finding per root cause even when it affects frontend, backend, and contracts.

## 8. Human Validation And Merge

For every AI finding, the maintainer:

1. Reproduces or traces the claim against current code and expected behavior.
2. Confirms the cited path, line, and affected execution path.
3. Accepts, rejects, or reframes the finding based on evidence.
4. Fixes accepted merge-blocking findings or records an explicit residual risk.
5. Re-runs the applicable human verification after fixes.

Record material rejected findings when the same concern is likely to recur.
AI confidence, repetition by multiple models, or a polished explanation is not
evidence by itself.

## 9. Review Boundaries

A read-only review must not:

- edit, format, generate, stage, commit, push, or post GitHub comments;
- run formatting, lint, type checks, tests, builds, migrations, or smoke checks;
- generate GraphQL artifacts or database migrations;
- install packages, skills, plugins, or external review applications;
- accept a finding or merge decision on the maintainer's behalf.

A separate explicit fix request starts a new implementation scope. Preserve the
review report as evidence, but re-read the affected code before editing.
