import { DocumentTypeConfig } from '@app/document-registry/document-registry.types';
import { Injectable } from '@nestjs/common';

import {
  CorrectionFieldMetadataView,
  CorrectionFieldView,
  CorrectionSchemaView,
  FlattenCorrectionDocumentInput,
  mapDocumentFieldInputType,
  mapDocumentFieldValidation,
} from '../correction-flow.types';
import { getValueAtPath, listConfiguredFieldTargets } from '../utils/document-paths';
import { getSourceProvenance } from '../utils/source-provenance';

@Injectable()
/**
 * Transforms registry metadata and session snapshots into the correction-document DTOs
 * consumed by GraphQL clients.
 */
export class FlattenService {
  /**
   * Builds the schema portion of the correction-document response from document-registry
   * metadata only.
   */
  buildCorrectionSchema(config: DocumentTypeConfig): CorrectionSchemaView {
    return {
      documentType: config.type,
      sections: config.sections.map((section) => ({
        fields: section.fields.map(
          (field): CorrectionFieldMetadataView => ({
            codeListKey: field.codeListKey ?? null,
            id: field.id,
            inputType: mapDocumentFieldInputType(field.inputType),
            label: field.label,
            path: field.path,
            required: field.required ?? false,
            validation: mapDocumentFieldValidation(field.validation),
          }),
        ),
        id: section.id,
        label: section.label,
        path: section.path,
        repeatable: section.repeatable,
      })),
      version: config.version,
    };
  }

  /**
   * Flattens the source and draft payloads into field views with stable field ids,
   * original values, current values, and provenance.
   */
  flattenFields(input: FlattenCorrectionDocumentInput): CorrectionFieldView[] {
    const targets = listConfiguredFieldTargets(input.config, input.snapshots.draftPayload);

    return targets.map((target) => ({
      codeList: null,
      id: target.fieldId,
      inputType: mapDocumentFieldInputType(target.fieldConfig.inputType),
      label: target.fieldConfig.label,
      originalValue: toNullableValue(getValueAtPath(input.snapshots.sourcePayload, target.path)),
      path: target.path,
      provenance: getSourceProvenance(input.snapshots.sourceProvenance, target.path),
      required: target.fieldConfig.required ?? false,
      rowPath: target.rowPath,
      sectionId: target.section.id,
      validation: mapDocumentFieldValidation(target.fieldConfig.validation),
      value: toNullableValue(getValueAtPath(input.snapshots.draftPayload, target.path)),
    }));
  }
}

/**
 * Converts an unresolved path lookup into the GraphQL contract's null shape.
 */
function toNullableValue(value: unknown): unknown {
  return value === undefined ? null : value;
}
