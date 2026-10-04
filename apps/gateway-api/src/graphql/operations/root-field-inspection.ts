import {
  type DocumentNode,
  type FragmentDefinitionNode,
  getDirectiveValues,
  getOperationAST,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  Kind,
  type OperationDefinitionNode,
  OperationTypeNode,
  parse,
  type SelectionNode,
  type SelectionSetNode,
} from 'graphql';

export interface SelectedRootFields {
  readonly operation: OperationTypeNode;
  readonly roots: readonly string[];
}

/** Reads roots whose execution directives permit activity in the selected operation. */
export function inspectExecutedRootFields(
  query: string,
  operationName?: null | string,
  variables?: unknown,
): null | SelectedRootFields {
  const document = parse(query);
  const operation = getOperationAST(document, operationName ?? undefined);

  if (!operation) {
    return null;
  }

  return {
    operation: operation.operation,
    roots: collectRootFields(
      document,
      operation.selectionSet,
      resolveDirectiveVariables(operation, variables),
    ),
  };
}

/** Reads only selected mutation roots; queries and unresolved operations have none. */
export function inspectMutationRoots(
  query: string,
  operationName?: null | string,
): null | string[] {
  const selected = inspectSelectedRootFields(query, operationName);

  return selected?.operation === OperationTypeNode.MUTATION ? [...selected.roots] : null;
}

/** Reads declared roots for pre-execution protections, including skipped selections. */
export function inspectSelectedRootFields(
  query: string,
  operationName?: null | string,
): null | SelectedRootFields {
  const document = parse(query);
  const operation = getOperationAST(document, operationName ?? undefined);

  if (!operation) {
    return null;
  }

  return {
    operation: operation.operation,
    roots: collectRootFields(document, operation.selectionSet),
  };
}

/** Collects roots iteratively, optionally filtering directives before marking fragments visited. */
function collectRootFields(
  document: DocumentNode,
  selectionSet: SelectionSetNode,
  variables?: Readonly<Record<string, unknown>>,
): string[] {
  const fragments = new Map<string, FragmentDefinitionNode>();

  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition);
    }
  }

  const roots: string[] = [];
  const visitedFragments = new Set<string>();
  const worklist: SelectionNode[] = [];
  pushSelections(selectionSet);

  /** Preserves document order without recursive expansion or argument spreading. */
  function pushSelections(current: SelectionSetNode): void {
    for (let index = current.selections.length - 1; index >= 0; index -= 1) {
      const selection = current.selections[index];

      if (selection) {
        worklist.push(selection);
      }
    }
  }

  while (worklist.length > 0) {
    const selection = worklist.pop();

    if (!selection) {
      continue;
    }

    if (variables && !shouldExecuteSelection(selection, variables)) {
      continue;
    }

    if (selection.kind === Kind.FIELD) {
      roots.push(selection.name.value);
      continue;
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      pushSelections(selection.selectionSet);
      continue;
    }

    const name = selection.name.value;
    const fragment = fragments.get(name);

    if (fragment && !visitedFragments.has(name)) {
      visitedFragments.add(name);
      pushSelections(fragment.selectionSet);
    }
  }

  return roots;
}

/** Resolves supplied variables and Boolean defaults without mutating request parameters. */
function resolveDirectiveVariables(
  operation: OperationDefinitionNode,
  input: unknown,
): Record<string, unknown> {
  if (input != null && (typeof input !== 'object' || Array.isArray(input))) {
    throw new TypeError('GraphQL variables must be an object');
  }

  const variables: Record<string, unknown> = input == null ? {} : { ...input };

  for (const definition of operation.variableDefinitions ?? []) {
    const name = definition.variable.name.value;

    if (!Object.hasOwn(variables, name) && definition.defaultValue?.kind === Kind.BOOLEAN) {
      variables[name] = definition.defaultValue.value;
    }
  }

  return variables;
}

/** Applies GraphQL's skip-before-include semantics and rejects unresolved directive values. */
function shouldExecuteSelection(
  selection: SelectionNode,
  variables: Readonly<Record<string, unknown>>,
): boolean {
  const skip = getDirectiveValues(GraphQLSkipDirective, selection, variables);

  if (skip && typeof skip.if !== 'boolean') {
    throw new TypeError('GraphQL skip condition must be a Boolean');
  }

  if (skip?.if === true) {
    return false;
  }

  const include = getDirectiveValues(GraphQLIncludeDirective, selection, variables);

  if (include && typeof include.if !== 'boolean') {
    throw new TypeError('GraphQL include condition must be a Boolean');
  }

  return include?.if !== false;
}
