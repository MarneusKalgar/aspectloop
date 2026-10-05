import type { IncomingMessage } from 'node:http';

import { getOperationAST, Kind, OperationTypeNode, parse } from 'graphql';

export type LiveOperation = 'CorrectionSessions' | 'Me' | 'SignIn' | 'SignOut';
const OPERATIONS: LiveOperation[] = ['CorrectionSessions', 'Me', 'SignIn', 'SignOut'];
const ROOTS = {
  CorrectionSessions: { kind: OperationTypeNode.QUERY, root: 'correctionSessions' },
  Me: { kind: OperationTypeNode.QUERY, root: 'me' },
  SignIn: { kind: OperationTypeNode.MUTATION, root: 'signIn' },
  SignOut: { kind: OperationTypeNode.MUTATION, root: 'signOut' },
};

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
export function selectedOperation(body: Buffer): LiveOperation {
  const input = JSON.parse(body.toString('utf8')) as { operationName?: unknown; query?: unknown };
  const name = OPERATIONS.find(
    /** Selects one of the four fixed local operations. */
    (candidate) => candidate === input.operationName,
  );

  if (!name || typeof input.query !== 'string') {
    throw new Error('E1 operation rejected');
  }

  const operation = getOperationAST(parse(input.query), name);
  const root = operation?.selectionSet.selections[0];

  if (
    !operation ||
    operation.operation !== ROOTS[name].kind ||
    operation.selectionSet.selections.length !== 1 ||
    root?.kind !== Kind.FIELD ||
    root.name.value !== ROOTS[name].root
  ) {
    throw new Error('E1 operation rejected');
  }

  return name;
}
