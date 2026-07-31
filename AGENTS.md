# Repository Agent Instructions

## Project Direction

- Treat this repository as an existing PoC being evolved, not a greenfield app.
- Preserve useful current behavior and refactor in milestone-sized changes.
- The canonical architecture and roadmap is `docs/general-plan.md`.
- Detailed workflow and model guidance is in
  `docs/agent-model-conventions.md`.
- Ignored `.raw/` files are research/history and `.plan/` files are working
  execution plans; neither is canonical documentation.

## Target Layout

- Runtime applications: `apps/web`, `apps/gateway-api`,
  `apps/extraction-service`, and `apps/correction-service`.
- Shared packages: `packages/contracts`, `packages/backend-platform`, and
  `packages/testing`.
- Local external-service mocks: `mocks/*`.
- Local infrastructure definitions and scripts: `infra/local`.
- Stage/cloud infrastructure definitions: `infra/stage`.
- Keep one flat root workspace. Do not create a nested `backend/` workspace.
- Each backend app owns its runtime, database schema, migrations, build, and
  deployment boundary.
- Keep service-specific domain code in its owning app. Move code to a shared
  package only after a real second consumer exists.
- Do not import backend internals into the web app.
- Keep `packages/contracts` framework-free: no NestJS, TypeORM, or React
  dependencies.

## Planning

- Every roadmap milestone needs an approved dated plan before implementation.
- Use ignored `.plan/` for temporary execution plans. Retain a completed plan
  under `docs/plans/` only when it has durable handoff or historical value.
- Plans must define scope, dependencies, affected areas, ordered work,
  human verification, completion criteria, risks, and explicit exclusions.
- Keep the general plan high level; do not duplicate milestone implementation
  details there.
- Transfer durable decisions to `docs/decisions/` and durable feature behavior
  to canonical feature documentation instead of preserving stale plans.
- Reference paths rather than fragile line numbers. Include code only when a
  contract or algorithm must be fixed before implementation.

## Execution

- Execute one approved milestone at a time and keep changes within its scope.
- Use the main agent as the only code writer by default. Use subagents only for
  independent, bounded, mainly read-heavy work with clear net benefit.
- Preserve unrelated working-tree changes. Work with overlapping user changes;
  never revert them silently.
- Use existing project patterns before introducing new abstractions.
- Use schema-first GraphQL at the public gateway boundary.
- Keep domain logic out of the gateway and provider-specific AI logic out of
  extraction/correction contracts.
- Optimize for a complete local workflow before cloud deployment.

## Editing And Git

- Use `rg`/`rg --files` for search and `apply_patch` for manual file edits.
- Keep edits ASCII unless an existing file or requirement needs Unicode.
- Do not run broad formatting/fix commands on unrelated files.
- Do not stage, commit, push, create a PR, deploy, or run destructive Git
  operations unless explicitly requested.
- Never expose secrets or copy proprietary code/data from reference projects.

## Verification

- Agents do not use TDD. Implement behavior first; add or update test code
  afterward only when it is in scope.
- Agents do not run formatting, lint, type checks, tests, builds, migrations,
  or local smoke checks. These commands and their interpretation are human
  work.
- Agents do not generate or hand-author database migrations. A human generates
  migrations through the repository's service-specific commands.
- Agents provide a proportional human verification checklist with exact
  commands, expected signals, and affected services. Report every unexecuted
  check clearly; never imply that it passed.
- A milestone is complete only after the human confirms its required checks and
  observable outcome, limitations are recorded, and canonical documentation is
  synchronized.

## Model Workflow

- Prefer GPT-5.6 Sol for architecture, ambiguous planning, high-risk changes,
  and final review.
- Prefer GPT-5.6 Terra for well-specified implementation and read-heavy scans.
- Prefer Luna/Terra for clear repetitive transformations.
- Plan and execute in the same main task when context remains focused; switch
  models between turns instead of creating a sequential handoff subagent.
- Start a fresh task when the approved milestone plan is a cleaner handoff than
  a long or repeatedly compacted planning context.
