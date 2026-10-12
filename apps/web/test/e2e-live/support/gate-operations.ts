import type { IncomingMessage } from 'node:http';

import { getOperationAST, Kind, OperationTypeNode, parse } from 'graphql';

import { GRAPHQL_OPERATION_NAME, type GraphqlOperationName } from '#app/graphql/operation-names';

interface LiveOperationPolicy {
  kind: OperationTypeNode;
  registrationRequired: boolean;
  root: string;
}

// Admission stays local and explicit; adding a shared name never enables live forwarding.
const LIVE_OPERATION_POLICY = Object.freeze({
  [GRAPHQL_OPERATION_NAME.CONFIRM_EMAIL]: {
    kind: OperationTypeNode.MUTATION,
    registrationRequired: true,
    root: 'confirmEmail',
  },
  [GRAPHQL_OPERATION_NAME.CORRECTION_SESSIONS]: {
    kind: OperationTypeNode.QUERY,
    registrationRequired: false,
    root: 'correctionSessions',
  },
  [GRAPHQL_OPERATION_NAME.ME]: {
    kind: OperationTypeNode.QUERY,
    registrationRequired: false,
    root: 'me',
  },
  [GRAPHQL_OPERATION_NAME.RESEND_EMAIL_CONFIRMATION]: {
    kind: OperationTypeNode.MUTATION,
    registrationRequired: true,
    root: 'resendEmailConfirmation',
  },
  [GRAPHQL_OPERATION_NAME.SIGN_IN]: {
    kind: OperationTypeNode.MUTATION,
    registrationRequired: false,
    root: 'signIn',
  },
  [GRAPHQL_OPERATION_NAME.SIGN_OUT]: {
    kind: OperationTypeNode.MUTATION,
    registrationRequired: false,
    root: 'signOut',
  },
  [GRAPHQL_OPERATION_NAME.SIGN_UP]: {
    kind: OperationTypeNode.MUTATION,
    registrationRequired: true,
    root: 'signUp',
  },
} as const satisfies Partial<Record<GraphqlOperationName, LiveOperationPolicy>>);

export type LiveOperation = keyof typeof LIVE_OPERATION_POLICY;

/** Collects one size-bounded private request; raw bytes never enter diagnostics. */
export async function readRequestBody(incoming: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of incoming) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += bytes.length;

    if (size > 65_536) {
      throw new Error('E1 request ceiling');
    }

    chunks.push(bytes);
  }

  return Buffer.concat(chunks);
}

/** Checks the selected kind/root, not merely a caller-supplied operation label. */
export function selectedOperation(body: Buffer, registrationEnabled = false): LiveOperation {
  const input = JSON.parse(body.toString('utf8')) as { operationName?: unknown; query?: unknown };
  const name = input.operationName;

  if (
    !isLiveOperation(name) ||
    typeof input.query !== 'string' ||
    (!registrationEnabled && LIVE_OPERATION_POLICY[name].registrationRequired)
  ) {
    throw new Error('E1 operation rejected');
  }

  const operation = getOperationAST(parse(input.query), name);
  const root = operation?.selectionSet.selections[0];

  if (
    !operation ||
    operation.operation !== LIVE_OPERATION_POLICY[name].kind ||
    operation.selectionSet.selections.length !== 1 ||
    root?.kind !== Kind.FIELD ||
    root.name.value !== LIVE_OPERATION_POLICY[name].root
  ) {
    throw new Error('E1 operation rejected');
  }

  return name;
}

/** Admits only own catalog keys, never unknown values or inherited object properties. */
function isLiveOperation(value: unknown): value is LiveOperation {
  return typeof value === 'string' && Object.hasOwn(LIVE_OPERATION_POLICY, value);
}
