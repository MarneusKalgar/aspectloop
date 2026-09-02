---
name: aspectloop-pr-compose
description: >
  Compose an AspectLoop pull-request title and description from the actual
  branch, working-tree, or GitHub PR diff using the repository template and
  verified evidence. Use when asked to draft, rewrite, or explicitly update an
  existing AspectLoop PR title or body; do not use for code review or merging.
---

# AspectLoop PR Compose

Produce an accurate PR title and a completed repository PR template. Preview
content by default. Update an existing GitHub PR only when the user explicitly
requests that mutation.

## Required Context

1. Read `AGENTS.md`, `.github/pull_request_template.md`, and
   `docs/review-process.md` before composing content.
2. Honor an explicit PR number, URL, base, commit range, or file scope. Never
   silently substitute a different PR.
3. For a local preview without an existing PR scope, use the merge-base process
   in `docs/review-process.md`. Inspect branch commits, `git status`, changed
   paths, diff statistics, the complete patch, and every untracked file in
   scope. Do not fetch unless the user asks.
4. For an existing PR, read its current title, body, base/head refs, head SHA,
   changed files, patch, and check status through read-only GitHub operations.
   Treat the GitHub PR diff as the content being described. Compare it with
   local `HEAD` and working-tree state, and disclose unpushed or uncommitted
   differences instead of describing them as part of the PR.
5. Read only the focused plans, ADRs, or feature documentation needed to
   understand the changed behavior and known limitations.

If the base is unavailable or stale, the PR cannot be resolved uniquely, or
the complete scoped diff cannot be inspected, stop and state what is missing.

## Composition Contract

### Title

- Follow the repository's recent human-authored title style. Prefer a concise
  milestone prefix and imperative outcome when the work belongs to a named
  submilestone, such as `M04B: Add Garage compatibility spike`.
- Describe the primary delivered outcome, not implementation trivia or every
  changed path. Do not invent an issue or milestone identifier.
- Keep an existing title when it remains accurate. Recommend a replacement
  only when it materially improves scope or correctness.
- Do not change draft state, labels, reviewers, milestones, or project fields.

### Description

- Preserve the exact headings and checkbox semantics from the current
  `.github/pull_request_template.md`; the template is the source of truth.
- Replace instructional placeholder text with concise, diff-specific content.
- Preserve material existing information such as issue links, closing
  keywords, human verification evidence, and reviewer notes. Reorganize it
  under the current template instead of silently dropping it.
- Describe bounded behavior and affected ownership surfaces. Do not turn the
  description into a file-by-file changelog.
- Choose risk from credible failure modes and blast radius. Record rollback or
  compatibility constraints when they matter.
- Explain user-interface evidence only for user-visible changes. Otherwise
  state why it is not applicable.
- Put deferred work, unsupported environments, verification gaps, and known
  limitations under `Residual Risk`.

## Evidence Rules

- Report a command or manual check as passed only when the human explicitly
  supplied its result or a read-only GitHub check shows that outcome for the
  exact PR head being described.
- Distinguish local human-reported evidence, CI-observed evidence, AI review,
  and checks not run by the composing agent. Never infer execution from the
  presence of a script, test file, screenshot placeholder, or expected command.
- A green AI check does not prove that its findings were reviewed or resolved.
  Complete the AI-review checkboxes only when the corresponding validation is
  evidenced.
- Mark GraphQL, migration, generated-artifact, dependency, and lockfile
  checkboxes from the actual diff and explicit review evidence. When uncertain,
  leave the checkbox open and explain the gap.
- Do not run formatting, lint, type checks, tests, builds, migrations, smoke
  checks, or generated-artifact commands. These remain human-owned under
  `AGENTS.md`.
- Do not expose secrets, signed URLs, raw request bodies, credentials, or
  sensitive diagnostic output in the PR description.

## Output Modes

### Preview (Default)

Return:

1. `Title` with the proposed title on the next line.
2. `Description` followed by one Markdown code block containing the complete
   PR body, ready for GitHub.
3. A short `Evidence gaps` note only when unresolved facts prevent fully
   completing the template.

Do not write a repository file, create a PR, or mutate GitHub in preview mode.

### Update Existing PR

Treat phrases such as `update PR #24`, `apply this to <PR URL>`, or an equally
explicit request to update the current branch's PR as authorization to update
that existing PR's title and body. This authorization does not extend to any
other GitHub mutation.

1. Resolve exactly one open PR from the supplied number/URL or current branch.
   Stop rather than guess when resolution is ambiguous.
2. Read the current PR and compose against its pushed GitHub diff. If local
   changes would materially alter the description but are not in that diff,
   disclose them and do not represent them as pushed.
3. Write the body through a temporary body file and pass title/body as separate
   arguments to the GitHub CLI or equivalent structured tool. Do not interpolate
   the Markdown into an ad hoc shell command.
4. Update only the title and body. Keep an already accurate title rather than
   rewriting it for style alone.
5. Read the PR back after mutation and verify the resulting title and body.
6. Return the PR URL, whether the title changed, and a concise summary of the
   body update. Do not post a comment containing a duplicate description.

If GitHub authentication or write access is unavailable, return the preview and
report that the requested mutation was not performed. Never create, close,
reopen, approve, merge, or otherwise submit a PR under this skill.
