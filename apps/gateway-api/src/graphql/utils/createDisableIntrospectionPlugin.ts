import type { Plugin } from 'graphql-yoga';

import { NoSchemaIntrospectionCustomRule } from 'graphql';

/**
 * Creates a Yoga validation plugin that rejects schema-introspection fields.
 *
 * @param disabled Whether introspection must be rejected for this environment.
 * @returns The validation plugin when disabled, otherwise no plugin.
 */
export function createDisableIntrospectionPlugin(disabled: boolean): Plugin | undefined {
  if (!disabled) {
    return undefined;
  }

  return {
    /** Adds GraphQL's standard rule while Yoga assembles request validation. */
    onValidate({ addValidationRule }) {
      addValidationRule(NoSchemaIntrospectionCustomRule);
    },
  };
}
