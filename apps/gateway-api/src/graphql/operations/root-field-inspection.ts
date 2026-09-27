import {
  type DocumentNode,
  type FragmentDefinitionNode,
  getOperationAST,
  Kind,
  OperationTypeNode,
  parse,
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

/** Finds actual root field names, including aliases and nested fragments. */
function collectRootFields(document: DocumentNode, selectionSet: SelectionSetNode): string[] {
  const fragments = new Map<string, FragmentDefinitionNode>();

  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition);
    }
  }

  const roots: string[] = [];

  /** Walks only root-level selection sets and avoids cyclic fragment input. */
  function visit(current: SelectionSetNode, visited: Set<string>): void {
    for (const selection of current.selections) {
      if (selection.kind === Kind.FIELD) {
        roots.push(selection.name.value);
      } else if (selection.kind === Kind.INLINE_FRAGMENT) {
        visit(selection.selectionSet, visited);
      } else {
        const name = selection.name.value;
        const fragment = fragments.get(name);

        if (fragment && !visited.has(name)) {
          visit(fragment.selectionSet, new Set([...visited, name]));
        }
      }
    }
  }

  visit(selectionSet, new Set());
  return roots;
}
