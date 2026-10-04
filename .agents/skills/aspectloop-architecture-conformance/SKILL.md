---
name: aspectloop-architecture-conformance
description: >
  Audit AspectLoop architecture and conventions across feature or milestone
  slices, including service ownership, duplication, type contracts, and the
  suitability of patterns, data structures, and algorithms. Use for focused
  structural audits, not ordinary broad diff reviews or implementation.
---

# AspectLoop Architecture Conformance

Assess whether the scoped implementation fits the project's architecture and
actual workload. Produce evidence-backed findings and bounded recommendations,
not a redesign wishlist. Complement `aspectloop-code-review`: that skill owns
broad diff review; this skill examines structural coherence across the requested
slices and their directly affected consumers.

## Read-Only Contract

- Do not implement findings, even when a correction seems trivial.
- Do not edit application code, tests, configuration, plans, documentation, or
  generated artifacts. Return the audit in the conversation.
- Do not run formatting, lint, type checks, tests, builds, benchmarks, migrations,
  or smoke checks. Source inspection and read-only Git inspection are allowed.
- Do not install dependencies, fetch, mutate Git/GitHub, post comments, create
  tasks, or delegate implementation as part of this audit.
- A separate explicit request is required to implement fixes or write/update a
  remediation brief. Treat that as a new scope, re-read affected code, and apply
  the repository's planning and verification rules. Audit approval alone is
  not implementation authorization.

## Establish Scope And Authority

1. Read `AGENTS.md`, `docs/review-process.md`, and relevant architecture sections
   of `docs/general-plan.md`, feature documentation, and ADRs. Read applicable
   nested instructions. Do not treat a remembered layout as current authority.
2. Resolve the user's slices, paths, or commit range to actual code. Inspect
   `git status` and identify committed, staged, unstaged, and untracked material
   in scope. For diff-based requests, inspect the complete scoped patch and
   untracked contents; use the base-selection rules in `docs/review-process.md`
   when the user did not supply a base.
3. Read the relevant milestone plan when available. Treat `.plan/` as working
   context and `.raw/` as history, not canonical architecture. Check claimed
   decisions and completion against current code and human-reported evidence.
4. Trace directly affected callers, consumers, exports, configuration, and test
   fixtures beyond the diff where necessary. Do not turn a slice audit into an
   unrelated repository-wide cleanup. State coverage limits and stale bases.

If scope cannot be resolved, ask for the missing range or plan rather than
inventing it. Classify discovered problems as introduced by the scoped changes,
pre-existing but directly relevant, or explicitly planned transition debt.

## Structural Checks

Follow the behavior from entry point through policy, domain ownership,
persistence, transport, and consumer. A compact ownership map is useful when
several services participate; do not create diagrams merely to satisfy a format.

- **Boundaries and responsibilities:** Check ownership of business rules,
  validation, authorization, transactions, state, and error translation. Look
  for gateway domain logic, cross-service database ownership, backend internals
  imported by Web, framework leakage into contracts, dependency cycles, and
  layers that merely forward calls without a real boundary responsibility.
- **Duplication:** Find repeated policies, constants, transformations, and
  state machines that can drift. Trace their consumers before recommending a
  shared owner. Similar-looking code is not enough: independent service rules,
  trust-boundary validation, and literal test expectations may intentionally
  repeat values. Require a real second consumer before shared-package extraction.
- **Types and contracts:** Identify the authoritative schema/type and its
  generation or derivation path. Check missing validation, handwritten copies,
  conflicting unions, unsafe casts, stale exports, and optionality drift. Do
  not collapse persistence entities, internal principals, transport DTOs, and
  public projections merely because their fields overlap. Preserve explicit
  projection that prevents private fields from leaking.
- **Conventions:** Check relevant import/export rules, naming, feature layout,
  JSDoc including changed callbacks, configuration schemas and consumers,
  generated-artifact ownership, and verification responsibility against current
  repository instructions. Separate an explicit rule violation from a taste
  preference. Never print secrets while inspecting local configuration.
- **Transitions:** Locate both old and new paths and establish which are live.
  Check compatibility adapters, registration, dependencies, configuration,
  fixtures, and retirement ownership. An approved temporary coexistence is not
  automatically a defect; a reachable conflicting path or missing retirement
  dependency can be. Do not recommend deleting retained behavior ahead of its
  approved milestone.

Apply SOLID, DRY, and KISS as reasoning aids, not scoring rubrics. A finding must
name the concrete coupling, drift, responsibility conflict, or unnecessary
complexity and its consequence. Do not demand an interface per class, generic
repository, design pattern, or extra layer merely to satisfy an acronym.

## Pattern, Data-Structure, And Algorithm Fit

Evaluate this only where it can materially affect the scoped behavior:

- Establish actual operations, access patterns, input sizes and growth bounds,
  and whether callers can supply adversarial inputs. Identify enforced limits
  and where they apply; a limit after expensive work does not bound that work.
- Trace time and space complexity, repeated traversal, recursion depth,
  allocation, retention, and I/O/query amplification on the relevant path.
  Consider both typical and credible worst-case inputs. For graph traversal,
  distinguish cycle prevention from repeated expansion of shared subgraphs.
- Check ordering, uniqueness, identity, concurrency, consistency, cancellation,
  and failure semantics before suggesting a collection, cache, batching scheme,
  traversal strategy, or architectural pattern. An optimization that changes
  those semantics is not an equivalent replacement.
- Compare the current design with the smallest sufficient alternative using
  existing project abstractions and dependencies. Retain straightforward code
  when the workload is bounded and no meaningful benefit is demonstrated.

Recommend a change only for demonstrated correctness problems, credible
performance/reliability risks, or material maintenance benefits. Explain the
triggering workload, expected benefit, tradeoffs, and smallest correction.
Do not claim measured speedups without measurements. Separate a source-provable
complexity defect from a profiling hypothesis; put unresolved performance
hypotheses under questions/residual risk with the evidence needed to decide.
Do not invent future scale, require fashionable patterns, add dependencies, or
propose speculative abstraction just because an alternative exists.

## Evidence And Disposition

Before reporting, trace the claimed path and check existing helpers, contracts,
tests, and documented exceptions. Existing tests show intended coverage, not
proof that a check ran or passed. Distinguish missing coverage from behavior
already exercised elsewhere. Use compatible specialist skills only when their
guidance is needed; do not load every review skill or require optional tools.

Consolidate one root cause into one finding, even across multiple services.
Use current file/line evidence and severity from `docs/review-process.md`.
For each finding provide:

- **Evidence and impact:** affected path, violated rule or invariant, and a
  concrete failure or maintenance consequence.
- **Smallest correction:** bounded direction, owning service/package, and
  material tradeoffs; not a speculative implementation patch.
- **Disposition:** current-scope prerequisite, documented later-milestone work,
  or unresolved ownership. Do not assign work to an invented roadmap task or
  silently approve a scope expansion.
- **Human verification:** the focused check and expected signal. Use exact
  commands only after confirming the repository scripts; otherwise state the
  required scenario or measurement without inventing a command.

## Output

Give a short scope statement, then preserve the repository review section order:

1. **Findings:** P0 to P3, with the evidence and disposition above. If none are
   actionable, state `No findings identified.` Do not manufacture findings.
2. **Open Questions / Assumptions:** only decisions or missing evidence that
   could change conclusions.
3. **Verification Observed:** distinguish static inspection, human/CI-reported
   results, and checks not run. Include a proportional human verification list.
4. **Residual Risk:** unreviewed surfaces and static-analysis limits. Include
   relevant intentional structures to preserve and approved transition debt,
   so a later implementer does not mistake them for cleanup targets.

Keep the audit self-contained. Do not write an implementation brief or change
milestone status automatically; the user can separately request a brief using
the findings they accept.
