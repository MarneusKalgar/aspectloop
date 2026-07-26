import { BadRequestException } from '@nestjs/common';
import { CustomScalar, Scalar } from '@nestjs/graphql';
import { Kind, parseValue as parseGraphqlValueLiteral, ValueNode } from 'graphql';

interface LenientParser {
  index: number;
  input: string;
}

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
    const parsedLenientValue = tryParseLenientStructuredString(trimmedValue);

    if (parsedLenientValue.parsed) {
      return parsedLenientValue.value;
    }

    return value;
  }
}

function consumeLenientCharacter(parser: LenientParser, expectedCharacter: string): void {
  skipLenientWhitespace(parser);

  if (peekLenientCharacter(parser) !== expectedCharacter) {
    throw new Error(`Expected ${expectedCharacter}`);
  }

  parser.index += 1;
}

function createLenientParser(input: string): LenientParser {
  return { index: 0, input };
}

function isLenientDigit(value: string | undefined): value is string {
  return value !== undefined && value >= '0' && value <= '9';
}

function isLenientIdentifierPart(value: string | undefined): value is string {
  return value !== undefined && /[A-Za-z0-9_$]/.test(value);
}

function isLenientIdentifierStart(value: string | undefined): value is string {
  return value !== undefined && /[A-Za-z_$]/.test(value);
}

function parseJsonLiteral(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.ENUM:
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

function parseLenientArray(parser: LenientParser): unknown[] {
  consumeLenientCharacter(parser, '[');
  skipLenientWhitespace(parser);

  const values: unknown[] = [];

  if (peekLenientCharacter(parser) === ']') {
    parser.index += 1;
    return values;
  }

  while (parser.index < parser.input.length) {
    values.push(parseLenientValue(parser));
    skipLenientWhitespace(parser);

    if (peekLenientCharacter(parser) === ',') {
      parser.index += 1;
      skipLenientWhitespace(parser);

      if (peekLenientCharacter(parser) === ']') {
        parser.index += 1;
        return values;
      }

      continue;
    }

    consumeLenientCharacter(parser, ']');
    return values;
  }

  throw new Error('Unterminated array literal');
}

function parseLenientEscapeSequence(value: string): string {
  switch (value) {
    case '"':
      return '"';
    case "'":
      return "'";
    case '\\':
      return '\\';
    case 'n':
      return '\n';
    case 'r':
      return '\r';
    case 't':
      return '\t';
    default:
      return value;
  }
}

function parseLenientIdentifier(parser: LenientParser): string {
  const start = parser.index;

  if (!isLenientIdentifierStart(peekLenientCharacter(parser))) {
    throw new Error('Expected identifier');
  }

  parser.index += 1;

  while (isLenientIdentifierPart(peekLenientCharacter(parser))) {
    parser.index += 1;
  }

  return parser.input.slice(start, parser.index);
}

function parseLenientNumber(parser: LenientParser): number {
  const numberMatch = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
    parser.input.slice(parser.index),
  );

  if (!numberMatch) {
    throw new Error('Expected number');
  }

  parser.index += numberMatch[0].length;

  return Number(numberMatch[0]);
}

function parseLenientObject(parser: LenientParser): Record<string, unknown> {
  consumeLenientCharacter(parser, '{');
  skipLenientWhitespace(parser);

  const value: Record<string, unknown> = {};

  if (peekLenientCharacter(parser) === '}') {
    parser.index += 1;
    return value;
  }

  while (parser.index < parser.input.length) {
    const key = parseLenientObjectKey(parser);

    skipLenientWhitespace(parser);
    consumeLenientCharacter(parser, ':');
    value[key] = parseLenientValue(parser);

    skipLenientWhitespace(parser);

    if (peekLenientCharacter(parser) === ',') {
      parser.index += 1;
      skipLenientWhitespace(parser);

      if (peekLenientCharacter(parser) === '}') {
        parser.index += 1;
        return value;
      }

      continue;
    }

    consumeLenientCharacter(parser, '}');
    return value;
  }

  throw new Error('Unterminated object literal');
}

function parseLenientObjectKey(parser: LenientParser): string {
  const character = peekLenientCharacter(parser);

  if (character === '"' || character === "'") {
    return parseLenientString(parser);
  }

  return parseLenientIdentifier(parser);
}

function parseLenientString(parser: LenientParser): string {
  const quote = peekLenientCharacter(parser);

  if (quote !== '"' && quote !== "'") {
    throw new Error('Expected string literal');
  }

  parser.index += 1;

  let value = '';

  while (parser.index < parser.input.length) {
    const character = parser.input[parser.index];

    if (character === quote) {
      parser.index += 1;
      return value;
    }

    if (character === '\\') {
      const escapedCharacter = parser.input[parser.index + 1];

      if (escapedCharacter === undefined) {
        throw new Error('Unterminated escape sequence');
      }

      value += parseLenientEscapeSequence(escapedCharacter);
      parser.index += 2;
      continue;
    }

    value += character;
    parser.index += 1;
  }

  throw new Error('Unterminated string literal');
}

function parseLenientValue(parser: LenientParser): unknown {
  skipLenientWhitespace(parser);

  const character = peekLenientCharacter(parser);

  if (character === undefined) {
    throw new Error('Expected value');
  }

  if (character === '{') {
    return parseLenientObject(parser);
  }

  if (character === '[') {
    return parseLenientArray(parser);
  }

  if (character === '"' || character === "'") {
    return parseLenientString(parser);
  }

  if (character === '-' || isLenientDigit(character)) {
    return parseLenientNumber(parser);
  }

  const identifier = parseLenientIdentifier(parser);

  switch (identifier) {
    case 'false':
      return false;
    case 'null':
      return null;
    case 'true':
      return true;
    default:
      return identifier;
  }
}

function peekLenientCharacter(parser: LenientParser): string | undefined {
  return parser.input[parser.index];
}

function shouldAttemptStringParse(value: string): boolean {
  return '"\'-0123456789[{fnt'.includes(value[0] ?? '');
}

function skipLenientWhitespace(parser: LenientParser): void {
  while (parser.index < parser.input.length && /\s/.test(parser.input[parser.index])) {
    parser.index += 1;
  }
}

function tryParseJsonDocument(value: string): ParsedJsonDocumentResult {
  try {
    return { parsed: true, value: JSON.parse(value) as unknown };
  } catch {
    return UNPARSED_JSON_DOCUMENT;
  }
}

function tryParseLenientStructuredString(value: string): ParsedJsonDocumentResult {
  try {
    const parser = createLenientParser(value);
    const parsedValue = parseLenientValue(parser);

    skipLenientWhitespace(parser);

    if (parser.index !== parser.input.length) {
      return UNPARSED_JSON_DOCUMENT;
    }

    return { parsed: true, value: parsedValue };
  } catch {
    return UNPARSED_JSON_DOCUMENT;
  }
}
