import type { CodegenConfig } from '@graphql-codegen/cli';

import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { z } from 'zod';

const workspaceRoot = fileURLToPath(new URL('.', import.meta.url));
const codegenMode = process.env.NODE_ENV ?? 'development';
const localSchemaPath = './graphql/schema.graphql';
const gqlSchemaAuthHeaderName = 'x-elemika-schema-auth';

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}, z.string().min(1).optional());

const optionalUrl = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}, z.url().optional());

const codegenEnvSchema = z
  .object({
    GQL_SCHEMA_AUTH_HEADER: optionalNonEmptyString,
    GQL_SCHEMA_URL: optionalUrl,
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'development' && !value.GQL_SCHEMA_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GQL_SCHEMA_URL is required in development mode.',
        path: ['GQL_SCHEMA_URL'],
      });
    }
  });

const loadedEnv = loadEnv(codegenMode, workspaceRoot, '');

const parsedCodegenEnv = codegenEnvSchema.safeParse({
  GQL_SCHEMA_AUTH_HEADER: loadedEnv.GQL_SCHEMA_AUTH_HEADER,
  GQL_SCHEMA_URL: loadedEnv.GQL_SCHEMA_URL,
  NODE_ENV: codegenMode,
});

if (!parsedCodegenEnv.success) {
  throw new Error(
    `Invalid web codegen environment: ${parsedCodegenEnv.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')}`,
  );
}

const schemaHeaders: Record<string, string> = parsedCodegenEnv.data.GQL_SCHEMA_AUTH_HEADER
  ? {
      [gqlSchemaAuthHeaderName]: parsedCodegenEnv.data.GQL_SCHEMA_AUTH_HEADER,
    }
  : {};

const config: CodegenConfig = {
  documents: ['src/**/*.{ts,tsx}'],
  generates: {
    './src/gql/': {
      config: {
        scalars: {
          DateTime: 'string',
          JSON: 'unknown',
        },
        useTypeImports: true,
      },
      preset: 'client',
    },
  },
  ignoreNoDocuments: true,
  schema: parsedCodegenEnv.data.GQL_SCHEMA_URL
    ? [
        {
          [parsedCodegenEnv.data.GQL_SCHEMA_URL]: {
            headers: schemaHeaders,
          },
        },
      ]
    : [localSchemaPath],
};

export default config;
