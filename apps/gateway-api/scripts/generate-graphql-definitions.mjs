#!/usr/bin/env node

import { GraphQLAstExplorer, GraphQLTypesLoader } from '@nestjs/graphql';
import { buildSchema, lexicographicSortSchema, parse, printSchema } from 'graphql';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const gatewayRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemaGlob = resolve(gatewayRoot, 'src/graphql/schema/**/*.graphql');
const defaultOutputPath = resolve(gatewayRoot, 'src/graphql/generated/graphql.types.ts');

/**
 * Generates sorted NestJS class definitions from the gateway-owned SDL.
 *
 * @param {string} outputPath Absolute output file path.
 * @returns {Promise<void>}
 */
async function generateGraphqlDefinitions(outputPath) {
  const typeDefinitions = await new GraphQLTypesLoader().mergeTypesByPaths(schemaGlob);
  const schema = lexicographicSortSchema(buildSchema(typeDefinitions));
  const document = parse(printSchema(schema));

  await mkdir(dirname(outputPath), { recursive: true });
  const sourceFile = await new GraphQLAstExplorer().explore(document, outputPath, 'class');
  await sourceFile.save();
}

/**
 * Resolves the optional generated-definition output argument.
 *
 * @param {string[]} args Command-line arguments after the script name.
 * @returns {string} Absolute generated-definition output path.
 */
function resolveOutputPath(args) {
  if (args.length > 1) {
    throw new Error('Expected at most one output path argument.');
  }

  return args[0] ? resolve(gatewayRoot, args[0]) : defaultOutputPath;
}

try {
  const outputPath = resolveOutputPath(process.argv.slice(2));

  await generateGraphqlDefinitions(outputPath);
  console.log(`Generated gateway GraphQL definitions: ${outputPath}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`Gateway GraphQL definition generation failed: ${message}`);
  process.exitCode = 1;
}
