import { Logger } from '@nestjs/common';
import { type DocumentNode, getOperationAST } from 'graphql';
import { isAsyncIterable, type Plugin } from 'graphql-yoga';

const ANONYMOUS_OPERATION = '<anonymous>';
const INVALID_OPERATION = '<invalid>';
const MAX_OPERATION_NAME_LENGTH = 128;
const OPERATION_NAME_PATTERN = /^[_A-Za-z][_0-9A-Za-z]*$/;

type GraphqlOutcome = 'failure' | 'success';

interface GraphqlResultSummary {
  errors?: readonly unknown[];
}

/**
 * Creates a Yoga plugin that emits one bounded completion event per operation.
 *
 * @returns A GraphQL Yoga execution plugin with no document or payload logging.
 */
export function createGraphqlLoggingPlugin(): Plugin {
  const logger = new Logger('GraphQL');

  return {
    /**
     * Captures only the bounded operation name needed by the completion hook.
     *
     * @param args GraphQL execution arguments.
     * @returns A hook that reports the final operation outcome.
     */
    onExecute({ args }) {
      const operationName = getBoundedOperationNameFromExecutionArgs(args);

      return {
        /**
         * Emits one completion for a regular operation or prepares streamed outcome tracking.
         *
         * @param result GraphQL execution result or result stream.
         * @returns Optional stream hooks when execution returns an async iterable.
         */
        onExecuteDone({ result }) {
          if (!isAsyncIterable(result)) {
            logGraphqlCompletion(logger, operationName, getGraphqlOutcome(result));
            return;
          }

          let outcome: GraphqlOutcome = 'success';

          return {
            /** Emits one final event after a streamed operation completes. */
            onEnd() {
              logGraphqlCompletion(logger, operationName, outcome);
            },
            /**
             * Accumulates failure state without logging streamed response values.
             *
             * @param nextResult The next streamed execution result.
             */
            onNext({ result: nextResult }) {
              if (getGraphqlOutcome(nextResult) === 'failure') {
                outcome = 'failure';
              }
            },
          };
        },
      };
    },
  };
}

/**
 * Resolves and bounds the selected operation name without retaining source text.
 *
 * @param document Parsed GraphQL document.
 * @param requestedOperationName Optional operation selected by the caller.
 * @returns A safe operation name or a stable placeholder.
 */
export function getBoundedOperationName(
  document: DocumentNode,
  requestedOperationName?: null | string,
): string {
  const operationName =
    getOperationAST(document, requestedOperationName ?? undefined)?.name?.value ??
    requestedOperationName;

  if (!operationName) {
    return ANONYMOUS_OPERATION;
  }

  if (
    operationName.length > MAX_OPERATION_NAME_LENGTH ||
    !OPERATION_NAME_PATTERN.test(operationName)
  ) {
    return INVALID_OPERATION;
  }

  return operationName;
}

/**
 * Reads only the typed operation metadata required from Yoga execution arguments.
 *
 * @param args Execution arguments exposed as loose values by Envelop's public types.
 * @returns A bounded operation name or the invalid placeholder.
 */
function getBoundedOperationNameFromExecutionArgs(args: unknown): string {
  if (!isExecutionOperationMetadata(args)) {
    return INVALID_OPERATION;
  }

  return getBoundedOperationName(args.document, args.operationName);
}

/**
 * Maps a GraphQL result to the bounded outcome vocabulary.
 *
 * @param result GraphQL execution result.
 * @returns Failure when the result contains one or more errors, otherwise success.
 */
function getGraphqlOutcome(result: GraphqlResultSummary): GraphqlOutcome {
  return result.errors?.length ? 'failure' : 'success';
}

/**
 * Narrows Yoga execution arguments without trusting arbitrary document values.
 *
 * @param value Candidate execution arguments.
 * @returns Whether the value contains a GraphQL document and valid operation name type.
 */
function isExecutionOperationMetadata(value: unknown): value is {
  document: DocumentNode;
  operationName?: null | string;
} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const metadata = value as Record<string, unknown>;
  const operationName = metadata.operationName;
  const document = metadata.document;

  return (
    typeof document === 'object' &&
    document !== null &&
    'kind' in document &&
    document.kind === 'Document' &&
    (operationName === undefined || operationName === null || typeof operationName === 'string')
  );
}

/**
 * Emits the stable GraphQL completion shape through the request-scoped Nest logger.
 *
 * @param logger Request-aware Nest logger.
 * @param operationName Bounded operation name.
 * @param outcome Final operation outcome.
 */
function logGraphqlCompletion(
  logger: Logger,
  operationName: string,
  outcome: GraphqlOutcome,
): void {
  logger.log({
    event: 'graphql.operation.completed',
    operationName,
    outcome,
  });
}
