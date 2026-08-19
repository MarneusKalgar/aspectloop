## Scope

Describe the bounded behavior or infrastructure change and the affected apps,
packages, contracts, or operational surfaces.

## Risk

- Risk level: low / medium / high
- Primary failure modes:
- Compatibility or rollback concerns:

## Human Verification

List the exact commands and manual checks that were run, with their results.
Do not report agent-unexecuted checks as passed.

```text
command -> result
```

## Generated Artifacts And Migrations

- [ ] GraphQL artifacts are unchanged or regenerated and reviewed.
- [ ] No database migration is required, or a human-generated migration is
      included and reviewed.
- [ ] Dependency manifest, lockfile, and install-script changes are absent or
      explicitly reviewed.

## UI Evidence

For user-visible changes, attach desktop/mobile screenshots or explain why they
are not applicable.

## Residual Risk

State known limitations, deferred verification, follow-up work, and any risk
that remains after the checks above.
