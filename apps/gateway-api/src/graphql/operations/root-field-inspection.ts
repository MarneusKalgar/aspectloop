import {
  type DocumentNode,
  type FragmentDefinitionNode,
  getOperationAST,
  Kind,
  OperationTypeNode,
  parse,
  type SelectionNode,
  type SelectionSetNode,
} from 'graphql';

export interface SelectedRootFields {
  readonly operation: OperationTypeNode;
  readonly roots: readonly string[];
}

/** Reads only selected mutation roots; queries and unresolved operations have none. */
export function inspectMutationRoots(
  query: string,
  operationName?: null | string,
): null | string[] {
  const selected = inspectSelectedRootFields(query, operationName);

  return selected?.operation === OperationTypeNode.MUTATION ? [...selected.roots] : null;
}

/** Reads the selected operation's actual top-level fields for Gateway policies. */
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

/** Collects selected top-level fields with each named fragment expanded at most once. */
function collectRootFields(document: DocumentNode, selectionSet: SelectionSetNode): string[] {
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
