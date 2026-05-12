import { BadRequestException } from '@nestjs/common';
import { CustomScalar, Scalar } from '@nestjs/graphql';
import { Kind, parseValue as parseGraphqlValueLiteral, ValueNode } from 'graphql';

type ParsedJsonDocumentResult = { parsed: false } | { parsed: true; value: unknown };

const UNPARSED_JSON_DOCUMENT: ParsedJsonDocumentResult = { parsed: false };

@Scalar('JSON', () => Object)
export class JsonScalar implements CustomScalar<unknown, unknown> {
  description =
    'Arbitrary JSON scalar. Accepts raw JSON/object values and coerces object-like string values.';

  parseLiteral(ast: ValueNode): unknown {
    return parseJsonLiteral(ast);
  }

  parseValue(value: unknown): unknown {
    return coerceJsonRuntimeValue(value);
  }

  serialize(value: unknown): unknown {
    return value;
  }
}

function coerceJsonRuntimeValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return coerceJsonString(value);
}

function coerceJsonString(value: string): unknown {
  const trimmedValue = value.trim();

  if (!shouldAttemptStringParse(trimmedValue)) {
    return value;
  }

  const parsedJsonValue = tryParseJsonDocument(trimmedValue);

  if (parsedJsonValue.parsed) {
    return parsedJsonValue.value;
  }

  try {
    return parseJsonLiteral(parseGraphqlValueLiteral(trimmedValue));
  } catch {
    return value;
  }
}

function parseJsonLiteral(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.INT:
      return Number(ast.value);
    case Kind.LIST:
      return ast.values.map((value) => parseJsonLiteral(value));
    case Kind.NULL:
      return null;
    case Kind.OBJECT:
      return ast.fields.reduce<Record<string, unknown>>((accumulator, field) => {
        accumulator[field.name.value] = parseJsonLiteral(field.value);
        return accumulator;
      }, {});
    case Kind.STRING:
      return coerceJsonString(ast.value);
    default:
      throw new BadRequestException('Unsupported JSON literal');
  }
}

function shouldAttemptStringParse(value: string): boolean {
  return '"-0123456789[{fnt'.includes(value[0] ?? '');
}

function tryParseJsonDocument(value: string): ParsedJsonDocumentResult {
  try {
    return { parsed: true, value: JSON.parse(value) as unknown };
  } catch {
    return UNPARSED_JSON_DOCUMENT;
  }
}
