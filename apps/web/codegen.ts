import type { CodegenConfig } from '@graphql-codegen/cli';

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { z } from 'zod';

const workspaceRoot = fileURLToPath(new URL('.', import.meta.url));
const codegenMode = process.env.NODE_ENV ?? 'development';
const localSchemaPath = resolve(workspaceRoot, '../gateway-api/src/graphql/schema/**/*.graphql');

const optionalUrl = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}, z.url().optional());

const codegenEnvSchema = z.object({
  GQL_SCHEMA_URL: optionalUrl,
});

const loadedEnv = loadEnv(codegenMode, workspaceRoot, '');

const parsedCodegenEnv = codegenEnvSchema.safeParse({
  GQL_SCHEMA_URL: loadedEnv.GQL_SCHEMA_URL,
});

if (!parsedCodegenEnv.success) {
  throw new Error(
    `Invalid web codegen environment: ${parsedCodegenEnv.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')}`,
  );
}

const config: CodegenConfig = {
  documents: ['src/**/*.{ts,tsx}'],
  generates: {
    './src/graphql/generated/': {
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
    ? [parsedCodegenEnv.data.GQL_SCHEMA_URL]
    : [localSchemaPath],
};

export default config;
