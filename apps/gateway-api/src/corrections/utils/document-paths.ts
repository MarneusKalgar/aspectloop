import { BadRequestException } from '@nestjs/common';

import {
  DocumentFieldConfig,
  DocumentTypeConfig,
} from '../../document-registry/document-registry.types';
import { CorrectionFieldTarget } from '../correction-flow.types';

/**
 * Reads a value from a nested document payload using dot-separated path tokens.
 */
export function getValueAtPath(root: unknown, path: string): unknown {
  const tokens = tokenizePath(path);
  let current: unknown = root;

  for (const token of tokens) {
    if (Array.isArray(current)) {
      const index = parseArrayIndex(token, path);
      current = current[index];
      continue;
    }

    if (!isRecord(current)) {
      return undefined;
    }

    current = current[token];
  }

  return current;
}

/**
 * Expands registry sections into stable field targets for both non-repeatable and
 * repeatable sections.
 */
export function listConfiguredFieldTargets(
  config: DocumentTypeConfig,
  draftPayload: Record<string, unknown>,
): CorrectionFieldTarget[] {
  const targets: CorrectionFieldTarget[] = [];

  for (const section of config.sections) {
    if (!section.repeatable) {
      for (const field of section.fields) {
        targets.push({
          fieldConfig: field,
          fieldId: `${section.id}:${field.id}`,
          path: field.path,
          rowPath: null,
          section,
        });
      }

      continue;
    }

    const sectionValue = getValueAtPath(draftPayload, section.path);

    if (!Array.isArray(sectionValue)) {
      continue;
    }

    for (const [index, row] of sectionValue.entries()) {
      const rowKey = resolveRowKey(row, index);
      const rowPath = `${section.path}.${index}`;

      for (const field of section.fields) {
        targets.push({
          fieldConfig: field,
          fieldId: `${section.id}:${rowKey}:${field.id}`,
          path: buildRepeatableFieldPath(section.path, field, index),
          rowPath,
          section,
        });
      }
    }
  }

  return targets;
}

/**
 * Writes a value into a nested document payload, creating intermediate arrays or
 * objects when required by the target path.
 */
export function setValueAtPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const tokens = tokenizePath(path);

  if (tokens.length === 0) {
    throw new BadRequestException('Path cannot be empty');
  }

  let current: unknown = root;

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index];
    const nextToken = tokens[index + 1];

    if (Array.isArray(current)) {
      const arrayIndex = parseArrayIndex(token, path);
      const existing: unknown = current[arrayIndex];

      if (!Array.isArray(existing) && !isRecord(existing)) {
        current[arrayIndex] = isArrayIndex(nextToken) ? [] : {};
      }

      current = current[arrayIndex];
      continue;
    }

    if (!isRecord(current)) {
      throw new BadRequestException(`Path ${path} cannot be applied to a non-object value`);
    }

    const existing = current[token];

    if (!Array.isArray(existing) && !isRecord(existing)) {
      current[token] = isArrayIndex(nextToken) ? [] : {};
    }

    current = current[token];
  }

  const lastToken = tokens[tokens.length - 1];

  if (Array.isArray(current)) {
    current[parseArrayIndex(lastToken, path)] = value;
    return;
  }

  if (!isRecord(current)) {
    throw new BadRequestException(`Path ${path} cannot be applied to a non-object value`);
  }

  current[lastToken] = value;
}

function buildRepeatableFieldPath(
  sectionPath: string,
  field: DocumentFieldConfig,
  rowIndex: number,
): string {
  const rowPath = `${sectionPath}.${rowIndex}`;

  if (field.path === sectionPath) {
    return rowPath;
  }

  if (field.path.startsWith(`${sectionPath}.`)) {
    return `${rowPath}.${field.path.slice(sectionPath.length + 1)}`;
  }

  return `${rowPath}.${field.path}`;
}

function isArrayIndex(value: string): boolean {
  return /^\d+$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseArrayIndex(token: string, path: string): number {
  if (!isArrayIndex(token)) {
    throw new BadRequestException(`Path ${path} uses non-numeric array segment ${token}`);
  }

  return Number(token);
}

function resolveRowKey(value: unknown, fallbackIndex: number): string {
  if (isRecord(value)) {
    if (typeof value.id === 'string' && value.id.trim().length > 0) {
      return value.id;
    }

    if (typeof value.lineId === 'string' && value.lineId.trim().length > 0) {
      return value.lineId;
    }
  }

  return String(fallbackIndex);
}

function tokenizePath(path: string): string[] {
  return path
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}
