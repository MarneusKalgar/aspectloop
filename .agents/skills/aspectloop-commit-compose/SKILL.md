---
name: aspectloop-commit-compose
description: >
  Stage, commit, and push scoped AspectLoop changes when directly invoked by
  name, unless the user asks for a narrower action or a draft. Also compose a
  commit message from an actual diff when asked. Do not run Git actions merely
  because this skill was automatically selected during implementation.
---

# AspectLoop Commit Compose

Produce an accurate commit message and perform the Git actions requested by the
user. A direct invocation of this skill defaults to staging, committing, and
pushing the scoped changes. This is the commit-level companion to
`aspectloop-pr-compose`.

## Authorization Contract

- Direct invocation by name, such as `$aspectloop-commit-compose` without a
  narrower instruction, authorizes staging, committing, and pushing the scoped
  changes. A request to draft or rewrite a message authorizes a read-only draft.
  Automatic skill selection, finishing implementation, or accepting a review
  does not authorize Git actions. Never append them to routine implementation.
- Honor explicit action requests without asking for redundant confirmation
  when the scope and destination are clear. Required sandbox/tool approval
  still applies. Authorization is bounded to this request, not future turns.
- "Stage these changes" authorizes staging only. "Commit these changes"
  authorizes staging the clearly identified changes and creating a commit.
  "Commit the staged changes" authorizes committing the current index only.
  "Push" authorizes publishing existing commits, not staging or committing.
  "Stage, commit, and push these changes" and direct skill invocation without
  a narrower instruction authorize the complete scoped flow.
- A request for a message, including an amended message, does not authorize
  creating or amending a commit. Amend, history rewriting, force-push, branch
  deletion, PR creation, and merge require their own explicit authorization;
  they are not normal fallbacks for this workflow.
- Do not independently run formatting, lint, type checks, tests, builds,
  migrations, smoke checks, or generation commands. An explicit commit/push
  request authorizes its configured Git hooks, including their checks and
  scoped formatting, as defined in `AGENTS.md`. This does not authorize running
  the scripts separately, changing hooks, or fixing failures.
- Do not edit application files, fix findings, install tools, change Git
  identity/configuration, or bypass hooks to make a Git operation succeed.

## Establish The Exact Changes

1. Read `AGENTS.md` and applicable commit guidance. Inspect `git status --short`
   and recent commit subjects/bodies to identify the current human-authored
   style. Do not let automated dependency updates dictate feature-commit style.
2. Honor explicit paths, staged/unstaged selection, commit SHA, or range. Resolve
   the requested scope before describing its behavior.
3. Without an explicit scope, prefer the index when staged changes exist:
   inspect `git diff --cached --name-status`, `git diff --cached --stat`, and
   the complete `git diff --cached --find-renames`. Exclude unstaged and
   untracked changes from that message and briefly disclose their exclusion.
4. If nothing is staged, inspect the tracked working-tree diff and relevant
   untracked files as a proposed future commit. Clearly label this scope as
   unstaged. Do not assume every untracked file belongs in the commit: ask when
   inclusion is ambiguous or could materially change the message. Do not read
   ignored local secrets or include ignored plans as committed deliverables.
5. For a specified existing commit, describe that commit's patch, not the
   current working tree. For a proposed amendment, establish whether the user
   means only rewriting the existing message or also including staged changes.
   Do not mix them silently. For a merge commit, clarify the intended comparison
   if the relevant change cannot be established unambiguously.
6. Inspect the full scoped patch, including additions and deletions. Read nearby
   code or focused plans only as needed to establish intent. For partially
   staged files, use index contents for context; working-tree contents may
   describe behavior absent from the proposed commit.

Do not use the branch's merge-base diff by default: a commit message describes
the selected commit-sized change, not the whole PR. If the patch is incomplete,
unavailable, or materially ambiguous, state what is missing instead of guessing.
If no changes exist in the selected scope, say so rather than invent a message.

## Composition

- Follow explicit user formatting first, then documented repository convention,
  then recent relevant human-authored style.
- Use a known milestone/submilestone prefix when supported by the scoped work,
  followed by a concise imperative outcome, such as
  `M04.2C3: Retire hybrid authentication`. Do not copy a branch label as proof
  of scope or invent milestone, issue, or ticket identifiers.
- Do not impose Conventional Commits unless requested or established for the
  relevant work. For changes without a milestone, use a concise descriptive
  subject consistent with repository practice.
- Describe the primary delivered behavior, not a file inventory or vague
  phrases such as "update code". Aim for a short, single-line subject without
  sacrificing accuracy to an arbitrary character count.
- Omit the body for a simple, self-explanatory change. Otherwise separate it
  from the subject with a blank line and explain why the change exists and the
  few material behavior, ownership, compatibility, or migration consequences.
  Keep it commit-sized; do not copy the PR template or an implementation plan.
- Distinguish implemented behavior from future work. Do not claim a milestone
  complete, a migration applied, or a defect fixed beyond what the diff and
  supplied evidence support.
- Include verification claims only when evidenced for the selected changes.
  Test files show coverage intent, not that tests passed. Keep uncertain or
  stale evidence outside the paste-ready message. Report checks observed through
  authorized hooks distinctly from human/CI results; do not claim unrun checks
  or pre-claim success for hooks that have not executed yet.
- Do not add sign-offs, co-author trailers, closing keywords, or breaking-change
  declarations without supporting evidence and applicable user/repository
  instructions. Never include credentials or sensitive diagnostic output.
- If the scope contains unrelated outcomes, flag that briefly and suggest
  logical commit boundaries without staging anything. Offer separate messages
  only when requested or needed to resolve the user's intended split; do not
  silently omit changes to make a single message sound coherent.

## Output

### Explicit Stage / Commit / Push (Direct Invocation Default)

1. Establish the exact changes using the inspection rules above. Read applicable
   branch-governance instructions before publishing. Identify the current branch,
   index, and any in-progress merge/rebase/cherry-pick. Stop for unresolved
   conflicts or an operation whose continuation the user has not authorized.
2. For a commit request without explicit paths, use the staged changes when
   present. If nothing is staged, use only changes clearly attributable to the
   current task. If the user explicitly names unstaged task changes, include
   those instead of silently limiting the commit to the index. Ask when ownership
   or inclusion is unclear, especially when unrelated changes are already
   staged. Never silently unstage someone else's work or include it in the
   commit.
3. Inspect selected changes for accidental secrets and ignored/local artifacts
   without echoing sensitive values. Stage only inspected, authorized paths or
   hunks. Prefer explicit pathspecs; do not use blanket `git add .`, `git add -A`,
   or `git commit -a` as a shortcut. Preserve partial staging; adding a whole
   partially staged file is allowed only when all its changes are in scope.
4. Re-read the staged patch after staging and compose the message from that
   exact content. Announce the scope and intended action, then proceed without
   requiring message approval unless the user requested a preview first. If
   the index is empty, do not create an empty commit unless explicitly requested.
5. Before each commit or push, initialize the required runtime in the same
   shell invocation as Git, using `.nvmrc`, `package.json` `engines` and
   `packageManager`, and any setup in `AGENTS.override.md`. When using nvm,
   explicitly load the available `nvm.sh` and run `nvm use` from the repository
   root, or the documented local alias. Check `node --version` and
   `npm --version` against repository requirements. Use fail-fast chaining so
   setup failure prevents Git execution. Do not rely on another terminal or a
   previous tool call; stop if the runtime is missing or incompatible instead
   of installing/upgrading it implicitly. Respect configured hooks and signing;
   never use `--no-verify`, `HUSKY=0`, or an equivalent bypass. On hook/signing
   failure, stop and report the blocker and workspace state rather than fix
   code, bypass safeguards, or change identity.
6. Create the commit with safely quoted arguments or a temporary message file;
   never interpolate untrusted message text into executable shell syntax. Read
   back its SHA, subject, included changes, and remaining working-tree status.
   Expected hook formatting within the authorized scope is permitted; inspect
   and disclose it. If hooks or concurrent edits introduce unrelated or
   unexpected content, stop and report the discrepancy rather than stage extra
   files, automatically amend, or continue to push.
7. Push only when requested, including direct skill invocation with no narrower
   action. Resolve the remote and destination branch from explicit user input
   or an unambiguous existing upstream. For a new feature branch, use the
   clearly established project remote and same branch name; ask if the
   destination is uncertain. Inspect the outgoing commit range, since pushing
   publishes all commits missing from the destination, not just the newest one.
   Surface unexpected unrelated commits before publishing. Remote-tracking refs
   can be stale; use a read-only remote query if needed and disclose uncertainty
   rather than claim a current comparison.
8. Use an explicit remote/refspec and a normal non-force push, setting upstream
   only when appropriate. Do not push all branches or tags, bypass protected
   branch rules, or invent a branch switch. On non-fast-forward rejection, stop;
   do not automatically pull, rebase, merge, reset, or force-push. If a network
   result is ambiguous, inspect remote state before retrying publication.
9. Confirm the command outcome and, where available, the destination ref's SHA.
   Report exactly what completed: staged paths, commit SHA/subject, push
   remote/branch and result, plus remaining changes and verification gaps.
   Include the selected Node/npm versions and observed hook outcomes. A
   successful commit/push does not prove all tests passed or a milestone finished.

Run the requested steps sequentially and stop at a failure. If commit succeeds
but push fails, retain and report the local commit; do not create another commit
on retry. A request to update this skill does not itself authorize committing
or pushing the skill changes.

### Draft (When Requested)

State the selected scope in one short line, then provide one `text` code block
containing the subject and optional body, ready to paste into a commit editor.
No shell command or automatic commit action is needed.

Add a brief note only for material exclusions, ambiguity, or unsupported claims.
When the user requests only the message and scope is clear, omit surrounding
commentary. Do not turn composition into an unsolicited code review.
