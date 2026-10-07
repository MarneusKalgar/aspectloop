import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';

import { isSafeReportLine } from './local-tool.mjs';

/** Reports fixed scenario status and cookie failure stages; raw errors, steps and output are omitted. */
export default class SafeReporter implements Reporter {
  private readonly required = [
    'E1-LIVE-01',
    'E1-LIVE-02',
    'E1-LIVE-02-CONCURRENT',
    'E1-LIVE-03',
    'E1-LIVE-04',
    'E1-LIVE-04-TIMEOUT',
    'E1-LIVE-04-OWNER',
    'E1-LIVE-05',
    'E1-LIVE-05-ERROR',
    'E1-LIVE-06',
    'E1-LIVE-06-READ',
    'E1-LIVE-07',
    'E1-LIVE-08-LOCK',
    'E1-LIVE-08-UNSUPPORTED',
    'E1-LIVE-08-CHANNEL',
    'E1-LIVE-08-CORRUPT',
    'E1-LIVE-08-DELETED',
    'E1-LIVE-08-DENIED',
    'E1-LIVE-08-WRITE',
    'E1-LIVE-09',
  ];
  private readonly results = new Map<string, TestResult['status']>();

  /** Gives a safe aggregate signal, not a false success when a prerequisite is missing. */
  onEnd(result: FullResult): Promise<{ status: FullResult['status'] }> {
    const passed = this.required.filter(
      /** Missing/skipped scenarios are pending evidence, never an accepted subset. */
      (id) => this.results.get(id) === 'passed',
    ).length;
    const complete = passed === this.required.length && this.results.size === this.required.length;
    const status = result.status === 'passed' && !complete ? 'failed' : result.status;
    process.stdout.write(`E1-LIVE-COUNTS passed=${passed} required=20 pending=${20 - passed}\n`);
    process.stdout.write(`E1-LIVE-SUMMARY ${status}\n`);

    return Promise.resolve({ status });
  }

  /** Omits fatal raw errors; the parent still fails on the runner's nonzero exit. */
  onError(): void {
    // Intentionally discard raw errors; aggregate status still reports failure.
  }

  /** Omits browser/backend stderr and stack traces. */
  onStdErr(): void {
    // Intentionally discard stderr rather than exposing private diagnostics.
  }

  /** Omits page/fixture stdout regardless of success or failure. */
  onStdOut(): void {
    // Intentionally discard raw stdout; only safe reporter records are emitted.
  }

  /** Emits only closed cookie-scenario failure labels; no error field or arbitrary step is printed. */
  onStepEnd(test: TestCase, _result: TestResult, step: TestStep): void {
    if (test.title !== 'E1-LIVE-09' || step.category !== 'test.step' || !step.error) {
      return;
    }

    const line = `E1-LIVE-09-STAGE ${step.title} failed`;

    if (isSafeReportLine(line)) {
      process.stdout.write(`${line}\n`);
    }
  }

  /** Emits only an allowlisted ID and a Playwright result category. */
  onTestEnd(test: TestCase, result: TestResult): void {
    const id = test.title.match(/^E1-LIVE-\d{2}(?:-[A-Z]+)?\b/)?.[0];

    if (id) {
      this.results.set(id, result.status);
      process.stdout.write(`${id} ${result.status}\n`);
    }
  }

  /** Suppresses the default terminal reporter and its credential-bearing call logs. */
  printsToStdio(): boolean {
    return true;
  }
}
