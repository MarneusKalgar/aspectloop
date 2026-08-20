---
name: aspectloop-code-review
description: >
  Review AspectLoop branch, PR, commit, or working-tree diffs read-only using
  repository boundaries and selectively chosen frontend, NestJS, GraphQL,
  database, Docker, CI, or security specialist skills. Use for review requests
  in this repository, not implementation or fix requests.
---

# AspectLoop Code Review

Produce one evidence-backed review without modifying the repository.

## Required Context

1. Read `AGENTS.md` and `docs/review-process.md`.
2. Honor the user's explicit base, commit range, PR, or file scope. Otherwise use
   the merge-base workflow documented in `docs/review-process.md`.
3. Inspect `git status`, changed-file names, diff statistics, the complete patch,
   and every untracked file in scope before drawing conclusions.
4. State when the available base may be stale or the requested diff cannot be
   reconstructed locally.

## Routing

Classify the needed review capabilities using `docs/review-process.md`. Inspect
the specialist skills actually available in the current environment and load
only compatible matches. Exact identifiers in the documentation are optional
known examples, not repository dependencies.

Match capabilities such as React/browser, accessibility, NestJS, GraphQL
schema, Apollo client, authentication/security, PostgreSQL/migrations,
Docker/Compose, GitHub Actions/supply chain, Playwright, or general source
quality. Add a second capability only when the changed behavior genuinely
crosses that boundary.

Do not load every available skill. Check a candidate's declared language,
framework, path, and task scope instead of trusting its name. If no compatible
specialist exists, apply the self-contained repository review contract directly
and disclose reduced specialization when material. Do not install a replacement
or fail the review because an optional specialist is absent.

Treat specialist templates as internal guidance. Normalize duplicate or
cross-boundary findings into one AspectLoop report.

## Review Contract

- Prioritize defects, regressions, security risks, contract breaks, migration
  hazards, and missing risk-proportionate coverage.
- Trace cross-boundary effects through web, gateway SDL/generated artifacts,
  service ownership, persistence, and CI where the diff reaches them.
- Use current file and line evidence. Ask a question instead of asserting an
  unsupported defect.
- Report generated GraphQL and human-generated migration implications without
  generating either artifact.
- Do not edit files, run human-owned verification commands, mutate Git or
  GitHub, or post comments. A separate fix request is required for mutation.

## Output

Follow the exact section order from `docs/review-process.md`:

1. Findings ordered P0 to P3.
2. Open Questions / Assumptions.
3. Verification Observed.
4. Residual Risk.

Each finding includes priority, concise title, file/line evidence, impact, and
bounded fix direction. If there are no actionable findings, write `No findings
identified.` and still disclose unexecuted verification and residual risk.
