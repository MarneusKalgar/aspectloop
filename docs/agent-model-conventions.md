# Agent, Planning, And Model Conventions

Status: Active  
Last updated: 2026-07-21

## 1. Purpose

This document defines how coding-agent work is planned, executed, verified, and
handed off in this repository. `AGENTS.md` contains the concise rules loaded for
every task; this document provides the rationale and detailed workflow.

## 2. Instruction Files

### Versioned repository guidance

`AGENTS.md` is the authoritative shared instruction file. Keep it concise and
practical. It defines repository structure, planning rules, execution rules,
verification expectations, and prohibited actions.

### Machine-local guidance

`AGENTS.override.md` is ignored by Git and contains machine-local paths and
personal environment notes. It must not contain secrets, tokens, passwords, or
proprietary content.

### Architecture and plans

- `docs/general-plan.md`: stable architecture and milestone roadmap.
- `.plan/YYYY-MM-DD-MNN-short-name.md`: temporary detailed milestone plans.
- `docs/plans/YYYY-MM-DD-MNN-short-name.md`: selected completed plans retained
  only when they provide durable handoff or historical value.
- `docs/decisions/NNNN-short-name.md`: versioned architecture decision records.
- `.raw/`: ignored research and discussion history; not canonical project
  documentation.

## 3. General Plan Convention

The general plan answers:

- what the product and target architecture are;
- which tracks and milestones exist;
- their priority, dependencies, and outcomes;
- which decisions and risks constrain future work.

It does not contain file-by-file implementation instructions. Milestone status
is updated only when an entire milestone changes state.

## 4. Milestone Plan Convention

Filename:

```text
.plan/YYYY-MM-DD-MNN-short-name.md
```

AI milestones use the ID from the general roadmap, for example:

```text
.plan/2026-10-05-AI10-text-extraction-provider.md
```

Required sections:

1. Metadata: milestone ID, status, date, owner/model where useful.
2. Objective and observable outcome.
3. Current-state evidence from the repository.
4. Preconditions and dependencies.
5. In scope and out of scope.
6. Architectural decisions and affected contracts.
7. Affected apps, packages, modules, and files.
8. Ordered implementation tasks.
9. Data migration, compatibility, and rollback concerns where applicable.
10. Human verification commands and expected signals.
11. Completion criteria.
12. Risks, open questions, and approved deviations.

Plans should:

- reference concrete paths but avoid fragile line numbers;
- use code blocks only when a schema, contract, or algorithm must be fixed
  before implementation;
- avoid duplicating architecture text already owned by the general plan;
- be executable by another task without replaying the entire planning chat;
- record decisions, not raw exploration logs;
- use implementation-first development; agents do not use TDD;
- distinguish agent implementation work from human verification work;
- identify schema changes that require a human-generated migration, including
  the exact service-specific generation command when it is known.

After completion, remove or archive the working plan unless it still provides
durable value. Transfer lasting architectural decisions to `docs/decisions/`
and lasting feature behavior to canonical feature documentation.

Plan states:

```text
proposed -> approved -> in-progress -> completed
                         |              |
                         +-> blocked     +-> superseded
```

## 5. Execution Convention

1. Read `AGENTS.md`, the approved milestone plan, and only the relevant source
   areas before editing.
2. Confirm that working-tree changes overlapping the milestone are understood
   and preserve unrelated user changes.
3. Execute one approved milestone at a time.
4. Use the main agent as the only code writer by default.
5. Keep changes within the plan. When an assumption is invalid, update the plan
   or ask for a decision rather than silently broadening scope.
6. Implement production behavior before test code; do not use TDD.
7. Add or update test code after implementation only when the approved scope
   requires it. The human owns test execution.
8. Do not run formatting, lint, type checks, tests, builds, migration commands,
   or local smoke checks. Provide the human with exact commands, scope, and
   expected signals instead.
9. Do not generate or hand-author database migrations. Implement the schema or
   entity change, then identify the service-specific command a human must use
   to generate the migration. Review a generated migration only when asked.
10. Record material deviations and the human verification status in the plan.
    Mark agent-unexecuted checks explicitly; never report them as passing.
11. Do not stage, commit, push, create a PR, deploy, or perform destructive Git
    operations unless explicitly requested.

## 6. Main Task Versus Subagents

The default is one main task for planning and execution.

Subagents are not prohibited, but they are used only when independent work can
run in parallel or when noisy read-heavy investigation would damage main-task
context. Good candidates are isolated codebase scans, test-log analysis,
security review, or independent contract review.

Avoid subagents for:

- a sequential plan-to-implementation handoff;
- one small or tightly coupled code change;
- multiple agents editing overlapping files;
- work where the parent must repeat the same repository investigation.

When a subagent is used:

- give it a bounded question, paths, constraints, and required output;
- prefer read-only exploration or review;
- require a concise evidence-backed summary;
- keep final decisions and integrated edits in the main task.

## 7. Model Selection

Model names and availability can change, so these are routing defaults rather
than repository requirements.

| Work                                                        | Default               | Reasoning          |
| ----------------------------------------------------------- | --------------------- | ------------------ |
| General architecture, difficult tradeoffs, polished roadmap | GPT-5.6 Sol           | High or Extra High |
| Detailed milestone planning                                 | GPT-5.6 Sol           | Medium or High     |
| Well-specified implementation                               | GPT-5.6 Terra         | Medium or High     |
| Cross-cutting/risky implementation                          | GPT-5.6 Sol           | High               |
| Repetitive extraction, transformation, summaries            | GPT-5.6 Luna or Terra | Low or Medium      |
| Independent read-heavy subagent                             | GPT-5.6 Terra         | Low or Medium      |
| Final review of a high-risk milestone                       | GPT-5.6 Sol           | High               |

Use the lowest reasoning level that reliably handles the work. Increase it for
ambiguity, architectural coupling, migration risk, security, or difficult
debugging rather than by default.

## 8. Recommended Same-Task Workflow

For a normal milestone:

1. Use Plan mode with Sol to investigate and write the milestone plan.
2. Review and approve the plan in the same task.
3. Switch the model to Terra and execute the approved plan in the main task.
4. Keep Sol for execution if the milestone is cross-cutting or remains
   ambiguous after planning.
5. Switch back to Sol for an independent final review only when risk justifies
   the added usage.

Changing models in the same task preserves the conversation and decisions. A
single Terra subagent is not a cheaper replacement because it starts a separate
agent thread, consumes its own model/tool work, and needs a handoff plus parent
review.

## 9. When To Start A Fresh Task

A new execution task can be more reliable when:

- planning produced extensive exploratory output;
- execution starts much later;
- the task has undergone repeated context compaction;
- the milestone is intentionally split into independently verifiable slices;
- a clean independent review is required.

The approved milestone plan is the compressed handoff. A fresh task should
need only `AGENTS.md`, that plan, and the relevant code, not the full historical
discussion.

## 10. Verification And Definition Of Done

Verification is intentionally human-owned. For each implementation task, the
agent supplies a proportional checklist containing:

- exact formatting, lint, type-check, test, build, and smoke commands that are
  relevant to the changed surface;
- migration generation and application commands for every affected service;
- expected success signals and any environment prerequisites;
- manual behavior checks that cannot be expressed as a command.

The agent does not execute those checks. CI may execute deterministic quality
gates automatically; that does not transfer local verification ownership to the
agent.

A milestone is complete only after the human confirms that:

- its observable outcome works;
- required human-generated migrations, contracts, and docs are synchronized;
- relevant tests and static checks pass;
- local startup or smoke behavior is verified where applicable;
- known limitations are documented;
- the plan records human verification and is marked completed;
- the general roadmap status is updated if the whole milestone is complete.

Until the human reports the required results, the agent must describe the work
as implemented but not human-verified. Passing lint alone is not completion.
Likewise, documentation-only planning does not authorize implementation until
the user asks to execute or approves the plan.

## 11. Git And Workspace Safety

- Assume unknown working-tree changes belong to the user.
- Never restore, overwrite, or reformat unrelated changes.
- Prefer targeted commands over repository-wide mutation.
- Never run destructive Git commands without explicit approval.
- Do not commit generated artifacts unless the repository convention requires
  them; generated GraphQL client types are currently part of the working tree
  and must remain synchronized when their source contract changes.
- Keep machine-specific paths and local preferences in `AGENTS.override.md`.

## 12. Maintaining These Conventions

Update these files when repeated friction demonstrates a missing rule. Avoid
adding speculative instructions. If a convention becomes tool-specific or
temporary, place it in `AGENTS.override.md` or task context rather than making
it a permanent repository rule.
