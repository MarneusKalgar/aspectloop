import {
  DocumentFieldConfig,
  DocumentSectionConfig,
  DocumentTypeConfig,
} from './document-registry.types';

export function validateDocumentTypeConfig(value: unknown): DocumentTypeConfig {
  if (!isRecord(value)) {
    throw new Error('Document type config must be an object');
  }

  const { label, sections, type, version } = value;

  if (!isNonEmptyString(type)) {
    throw new Error('Document type config is missing a valid "type"');
  }

  if (!isNonEmptyString(label)) {
    throw new Error(`Document type config "${type}" is missing a valid "label"`);
  }

  if (typeof version !== 'number' || !Number.isInteger(version) || version <= 0) {
    throw new Error(`Document type config "${type}" is missing a valid positive integer "version"`);
  }

  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error(`Document type config "${type}" must contain at least one section`);
  }

  return {
    label,
    sections: sections.map((section, index) => validateDocumentSectionConfig(section, type, index)),
    type,
    version,
  };
}

function isDocumentFieldInputType(value: unknown): value is DocumentFieldConfig['inputType'] {
  return ['code-list', 'date', 'number', 'text'].includes(String(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validateDocumentFieldConfig(
  value: unknown,
  documentType: string,
  sectionId: string,
  index: number,
): DocumentFieldConfig {
  if (!isRecord(value)) {
    throw new Error(
      `Field #${index} in section "${sectionId}" for document type "${documentType}" must be an object`,
    );
  }

  const { id, inputType, label, path, required } = value;

  if (!isNonEmptyString(id) || !isNonEmptyString(label) || !isNonEmptyString(path)) {
    throw new Error(
      `Field #${index} in section "${sectionId}" for document type "${documentType}" is missing required string properties`,
    );
  }

  if (!isDocumentFieldInputType(inputType)) {
    throw new Error(
      `Field "${id}" in section "${sectionId}" for document type "${documentType}" has unsupported inputType`,
    );
  }

  if (required !== undefined && typeof required !== 'boolean') {
    throw new Error(
      `Field "${id}" in section "${sectionId}" for document type "${documentType}" has invalid "required"`,
    );
  }

  return {
    id,
    inputType,
    label,
    path,
    required,
  };
}

function validateDocumentSectionConfig(
  value: unknown,
  documentType: string,
  index: number,
): DocumentSectionConfig {
  if (!isRecord(value)) {
    throw new Error(`Section #${index} for document type "${documentType}" must be an object`);
  }

  const { fields, id, label, path, repeatable } = value;

  if (!isNonEmptyString(id) || !isNonEmptyString(label) || !isNonEmptyString(path)) {
    throw new Error(
      `Section #${index} for document type "${documentType}" is missing required string properties`,
    );
  }

  if (typeof repeatable !== 'boolean') {
    throw new Error(
      `Section "${id}" for document type "${documentType}" must define a boolean "repeatable"`,
    );
  }

  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error(
      `Section "${id}" for document type "${documentType}" must contain at least one field`,
    );
  }

  return {
    fields: fields.map((field, fieldIndex) =>
      validateDocumentFieldConfig(field, documentType, id, fieldIndex),
    ),
    id,
    label,
    path,
    repeatable,
  };
}
