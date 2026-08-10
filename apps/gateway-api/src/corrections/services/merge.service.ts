import { DocumentTypeConfig } from '@app/document-registry/document-registry.types';
import { BadRequestException, Injectable } from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';

import {
  CORRECTION_SOURCE_USER_EDIT,
  MergeCorrectionEditAuditDraft,
  MergeCorrectionEditInput,
  MergeResult,
} from '../correction-flow.types';
import {
  getValueAtPath,
  listConfiguredFieldTargets,
  setValueAtPath,
} from '../utils/document-paths';

@Injectable()
/**
 * Applies field-level correction edits back onto the hierarchical draft payload.
 */
export class MergeService {
  /**
   * Validates submitted field targets, updates the draft tree, and emits audit entries
   * only for effective value changes.
   */
  applyEdits(
    config: DocumentTypeConfig,
    draftPayload: Record<string, unknown>,
    edits: MergeCorrectionEditInput[],
    editedBy: string,
  ): MergeResult {
    const fieldTargets = listConfiguredFieldTargets(config, draftPayload);
    const targetByFieldId = new Map(fieldTargets.map((target) => [target.fieldId, target]));
    const targetByPath = new Map(fieldTargets.map((target) => [target.path, target]));
    const nextDraftPayload = structuredClone(draftPayload);
    const auditEntries: MergeCorrectionEditAuditDraft[] = [];
    const editedAt = new Date();

    for (const edit of edits) {
      const target = targetByFieldId.get(edit.fieldId) ?? targetByPath.get(edit.path);

      if (!target) {
        throw new BadRequestException(
          `Unsupported correction field ${edit.fieldId} at ${edit.path}`,
        );
      }

      if (target.path !== edit.path) {
        throw new BadRequestException(
          `Correction field ${edit.fieldId} does not match requested path ${edit.path}`,
        );
      }

      const previousValue = getValueAtPath(nextDraftPayload, target.path);

      if (isDeepStrictEqual(previousValue, edit.value)) {
        continue;
      }

      setValueAtPath(nextDraftPayload, target.path, edit.value ?? null);

      auditEntries.push({
        editedAt,
        editedBy,
        fieldId: target.fieldId,
        newValue: edit.value ?? null,
        path: target.path,
        previousValue: previousValue === undefined ? null : previousValue,
        source: CORRECTION_SOURCE_USER_EDIT,
      });
    }

    return {
      auditEntries,
      draftPayload: nextDraftPayload,
    };
  }
}
