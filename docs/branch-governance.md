# Branch Governance

Status: Active
Last updated: 2026-08-14

## Integration Model

`main` is AspectLoop's only permanent integration branch. Feature and
maintenance branches enter `main` through pull requests.

The repository does not maintain permanent `development`, `release/*`, or
production branches. A branch name does not represent an environment.

M11 may introduce a manually dispatched stage deployment workflow with an
explicit source-ref input that defaults to `main`. That workflow remains a
separate deployment concern and does not change the integration model.

## Pull Request Contract

Pull requests target `main` and should remain reviewable as one bounded change.
The author records scope, risk, generated artifacts or migrations, human
verification, and residual limitations.

M03-B will introduce deterministic pull-request checks. After the workflow has
run at least once and GitHub has registered its names, branch protection uses
`All Checks Passed` as the single required aggregate status. Independent jobs
remain visible for diagnosis, but branch rules depend on the stable aggregate
rather than every implementation-specific job name.

The required workflow must use `pull_request`, never `pull_request_target`, for
repository code. Pull-request jobs receive read-only repository permission and
no deployment credentials or environment secrets.

## Expected Main Rules

Configure these rules after M03-B creates and successfully runs the workflow:

- require a pull request before merging;
- require `All Checks Passed` and require the branch to be current where the
  repository plan supports it;
- require review conversations to be resolved;
- block force pushes and deletion of `main`;
- do not grant pull-request workflows write, package, OIDC, environment, or
  deployment permission;
- do not allow an AI reviewer to satisfy a human approval rule.

AspectLoop currently has one maintainer. Branch rules therefore do not require
an unavailable second-human approval. The maintainer may merge after required
checks pass, the diff and AI findings have been independently reviewed, and all
material conversations are resolved. Deterministic checks remain mandatory.

## Retiring Development

The legacy remote `development` branch may be deleted only after a human
confirms that no open pull request targets it and that it contains no unique
work that should be retained. Do not rewrite history or force-update `main`.

After that check, the human may remove the remote branch and any stale local
tracking reference. Historical feature branches can be deleted independently
when their work is already reachable from `main`.

## Emergency Changes

An urgent fix still uses a pull request and the required deterministic checks.
If GitHub itself prevents the required workflow from running, document the
incident and temporarily change only the unavailable rule. Restore the rule as
soon as the workflow is healthy. Never bypass a failing product or security
check merely because the change is urgent.
