# CI/CD Mental Model For JS/TS Engineers

Status: Educational reference  
Last updated: 2026-08-19

GitHub Actions can be understood as a distributed Node.js application whose
composition is declared in YAML and whose nontrivial implementation logic lives
in repository scripts.

This article explains the concepts. AspectLoop's normative merge and workflow
rules remain in [`../branch-governance.md`](../branch-governance.md).

## CI, Delivery, And Deployment

- **Continuous integration (CI)** is equivalent to running a clean
  `npm ci && npm run verify` for every pull request. It proves that a change can
  be integrated into `main`.
- **Continuous delivery** produces a deployable artifact after CI but requires
  an explicit promotion or approval before deployment.
- **Continuous deployment** automatically deploys every change that passes the
  required pipeline.

AspectLoop currently implements CI. Its future manually dispatched stage
deployment is continuous delivery rather than fully automatic continuous
deployment.

## Pipeline As An Async Program

The current pull-request workflow can be represented as TypeScript:

```ts
async function prChecks(event: GitHubEvent): Promise<void> {
  const results = await Promise.all([quality(event), mockedWebE2E(event), dockerPolicy(event)]);

  allChecksPassed(results);
}
```

Each function in `Promise.all()` is actually an isolated GitHub job running on
its own runner. The final function is the stable merge gate.

## Concept Map

| CI/CD concept            | JS/TS analogy                                             |
| ------------------------ | --------------------------------------------------------- |
| Workflow                 | Application composition root or `main.ts`                 |
| Trigger                  | Event listener such as `app.on('pull_request', handler)`  |
| Job                      | Isolated Node child process or worker                     |
| Step                     | Function call inside that process                         |
| Action                   | npm package providing reusable behavior                   |
| Composite action         | Local helper that combines several steps                  |
| Reusable workflow        | Module exposing a complete isolated pipeline or job       |
| Runner                   | Machine containing the runtime and operating system       |
| Input                    | Function argument                                         |
| Output                   | Function return value                                     |
| Environment variable     | `process.env` configuration                               |
| Secret                   | Capability token passed only to authorized code           |
| Permission               | Minimal interface defining allowed capabilities           |
| Artifact                 | Persisted `dist/`, report, screenshot, or log output      |
| Cache                    | Reusable package downloads or build inputs                |
| Matrix                   | `test.each()` or mapping one function over configurations |
| `needs`                  | `await` or an edge in a promise dependency graph          |
| Concurrency cancellation | `AbortController` cancelling obsolete work                |
| Branch protection        | Guard preventing an invalid state transition              |

## YAML As The Composition Root

Workflow YAML should describe what executes, where, when, and with which
permissions:

```yaml
jobs:
  quality:
  mocked_web_e2e:
  docker_policy:
```

This resembles NestJS module wiring or route registration. Short, linear shell
commands can remain inline, but parsing and policy logic should not accumulate
inside the composition root.

AspectLoop's orchestrator is
[`../../.github/workflows/pr-checks.yml`](../../.github/workflows/pr-checks.yml).

## Repository JavaScript As A Service

The workflow can delegate implementation logic to a plain Node.js module:

```yaml
- name: Detect changes
  run: node scripts/ci/detect-changes.mjs docker
```

The YAML step acts like a thin controller. The referenced
[`detect-changes.mjs`](../../scripts/ci/detect-changes.mjs) service owns event
parsing, validation, Git invocation, and stable outputs. Its accepted modes and
paths come from repository-owned
[`change-groups.mjs`](../../scripts/ci/change-groups.mjs), not arbitrary
workflow input.

Use this pattern for branching, JSON parsing, reusable policy, and other logic
that benefits from normal JS structure. Keep simple commands such as
`npm run verify` directly in YAML.

## Composite Action Versus Reusable Workflow

A composite action resembles extracting repeated statements into a helper:

```ts
async function bootstrapWorkspace(): Promise<void> {
  await setupNode();
  await installNpm();
  await assertVersions();
  await npmCi();
}
```

It remains inside one job. AspectLoop keeps its Node/npm bootstrap explicit
while only two jobs share it; a composite action becomes reasonable when a real
third consumer adopts the same complete sequence.

A reusable workflow resembles a module that owns an entire worker process:

```ts
const result = await runDockerPolicyWorkflow({ runDocker });
```

It can own a runner, timeout, permissions, checkout, steps, and summaries. That
is why AspectLoop isolates Docker policy in
[`reusable-docker-policy.yml`](../../.github/workflows/reusable-docker-policy.yml).

## Job Isolation And Caching

Jobs do not share memory, working directories, or `node_modules`:

```ts
qualityWorker.memory !== e2eWorker.memory;
```

Each trust-isolated job therefore performs its own `npm ci`. The jobs may reuse
npm's download cache, which is comparable to separate test workers downloading
from the same package cache without sharing a mutable installed tree.

Artifacts are different from caches. An artifact is an intentional output for
another job or a human, such as a built package or Playwright failure report. A
cache is an optimization and must not become the source of correctness.

## Actions As Dependencies

An external action is a CI dependency. This reference:

```yaml
uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd
```

is analogous to installing an exact npm dependency with verified integrity.
Using a mutable branch or floating reference is closer to installing `latest`
during every CI run.

Permissions should follow the same principle as narrow TypeScript interfaces:
provide only the capabilities a job requires. A called workflow must not gain
additional permissions or secrets merely because its caller has them.

## Aggregate Merge Gate

`All Checks Passed` acts as a facade over internal checks:

```ts
function allChecksPassed(results: JobResult[]): void {
  if (results.some((result) => result !== 'success')) {
    throw new Error('Merge rejected');
  }
}
```

Branch protection depends on this stable public interface. Internal diagnostic
jobs may then be reorganized without repeatedly changing the repository's
required-check configuration.

## Future Delivery Shape

A stage delivery flow should resemble:

```ts
const artifact = await buildOnce(commitSha);
await verifyArtifact(artifact);
await humanApproval();
await deployToStage(artifact);
await smokeCheckStage();
```

The same immutable artifact should be promoted after verification. Rebuilding
separately for stage is analogous to compiling the same TypeScript source twice
and assuming both outputs must be identical.
