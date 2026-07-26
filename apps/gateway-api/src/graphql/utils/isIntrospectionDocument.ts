import { type DocumentNode, visit } from 'graphql';

export function isIntrospectionDocument(document: DocumentNode) {
  let hasIntrospectionField = false;

  visit(document, {
    Field(node) {
      if (node.name.value === '__schema' || node.name.value === '__type') {
        hasIntrospectionField = true;
        return false;
      }

      return undefined;
    },
  });

  return hasIntrospectionField;
}
