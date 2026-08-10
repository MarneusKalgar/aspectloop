export function getOperationErrorMessage(error: unknown): null | string {
  if (!error) {
    return null;
  }

  if (isRecord(error)) {
    const graphQLErrorMessage =
      readErrorArrayMessage(error.graphQLErrors) ?? readErrorArrayMessage(error.errors);

    if (graphQLErrorMessage) {
      return graphQLErrorMessage;
    }

    const causeMessage = getOperationErrorMessage(error.cause);

    if (causeMessage) {
      return causeMessage;
    }

    const message = error.message;

    if (typeof message === 'string' && message.trim().length > 0) {
      return message.trim();
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readErrorArrayMessage(value: unknown): null | string {
  if (!Array.isArray(value)) {
    return null;
  }

  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }

    const message = entry.message;

    if (typeof message === 'string' && message.trim().length > 0) {
      return message.trim();
    }
  }

  return null;
}
