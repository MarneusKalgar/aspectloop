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
- During implementation, record status, deviations, open questions, and human
  verification results in the working milestone plan only. Do not repeatedly
  update canonical documentation for behavior that is still changing or has
  not been human-verified.
- After the human confirms the desired behavior, perform one documentation
  synchronization pass for affected canonical docs, ADRs, and the general-plan
  milestone status. Update them earlier only when documentation is itself the
  deliverable or the user explicitly requests it.
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
- Keep same-feature and directly adjacent application imports relative. Use the
  owning application's Node-native private `#app/*` alias for handwritten
  cross-feature or multi-parent source imports. Its TypeScript source mapping
  and package runtime mapping must resolve the same module boundary. In root
  test runners that cover multiple backend services, use unique service aliases
  such as `@gateway/*`; never map a shared application alias to one service.
  Keep cross-workspace imports on package exports and do not normalize
  generated-file imports manually.
- Use schema-first GraphQL at the public gateway boundary.
- Keep domain logic out of the gateway and provider-specific AI logic out of
  extraction/correction contracts.
- Optimize for a complete local workflow before cloud deployment.

## Automation And CI

- Keep workflow YAML declarative: triggers, permissions, concurrency, jobs,
  conditions, action calls, and bounded summaries belong in workflow files.
- Keep only short, linear shell orchestration inline. Move branching, event or
  JSON parsing, reusable policy, and other substantial logic to fixed-purpose
  `scripts/ci/*.mjs` files.
- Use reusable workflows for complete job boundaries. Consider a local
  composite action only after the same complete step sequence has a real third
  consumer; do not add one only to reduce a workflow's line count.
- Keep CI scripts closed over repository-defined configuration. Do not use
  `eval`, dynamic commands, arbitrary path lists, or unbounded workflow input.
- Preserve least-privilege workflow permissions, do not inherit secrets into
  jobs that do not need them, and pin every external action to a reviewed full
  commit SHA with a version comment.
- Follow the detailed workflow conventions and merge-gate contract in
  `docs/branch-governance.md`.

## Editing And Git

- Use `rg`/`rg --files` for search and `apply_patch` for manual file edits.
- Keep edits ASCII unless an existing file or requirement needs Unicode.
- Add JSDoc immediately above every function or method added or materially
  changed by an agent, including private helpers and callback methods. In
  JavaScript and MJS files, use multiline JSDoc with `@param`, `@returns`, and
  other applicable tags; a one-line summary alone is not sufficient.
- In JavaScript and TypeScript, always wrap control-flow bodies in braces and
  place the body on separate lines, including single-statement `if`, `else`,
  loop, `try`, and `catch` bodies.
- When an environment variable is added or changed in an `.env.example`, apply
  the same key and structural change to the relevant local `.env` file in the
  same task. Preserve existing machine-specific values and secrets; never copy
  them back into the example.
- For every added or changed environment variable, inspect each consuming
  runtime or tool and its environment validation schema. Update every relevant
  schema and focused schema coverage in the same task. If an infrastructure-only
  variable has no application schema, validate it at its consuming boundary
  rather than duplicating it into unrelated service schemas.
- Keep `.env.example` and local `.env` files grouped into commented subsystem
  sections with blank lines between sections. A local env file must remain as
  readable and structured as its example rather than becoming a flat key list.
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

## Review

- Follow `docs/review-process.md` for local verification, read-only local AI
  review, and GitHub pull-request review.
- Use `.agents/skills/aspectloop-code-review/SKILL.md` as the repository router
  for branch, PR, commit, or working-tree review requests.
- Keep review read-only unless the user separately requests a fix. Select only
  specialist capabilities relevant to the changed paths, use compatible skills
  only when available, and normalize duplicate findings into one findings-first
  report.
- AI findings are advisory and must be independently validated by a human.

## Model Workflow

- Prefer GPT-5.6 Sol for architecture, ambiguous planning, high-risk changes,
  and final review.
- Prefer GPT-5.6 Terra for well-specified implementation and read-heavy scans.
- Prefer Luna/Terra for clear repetitive transformations.
- Plan and execute in the same main task when context remains focused; switch
  models between turns instead of creating a sequential handoff subagent.
- Start a fresh task when the approved milestone plan is a cleaner handoff than
  a long or repeatedly compacted planning context.
