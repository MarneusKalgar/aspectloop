import {
  CORRECTION_OUTBOX_STATUS_FAILED,
  CORRECTION_OUTBOX_STATUS_PENDING,
  CORRECTION_OUTBOX_STATUS_PUBLISHED,
  CORRECTION_PUBLISH_STATUS_FAILED,
  CORRECTION_PUBLISH_STATUS_NOT_QUEUED,
  CORRECTION_PUBLISH_STATUS_PENDING,
  CORRECTION_PUBLISH_STATUS_PUBLISHED,
  CorrectionEventOutboxRecord,
  CorrectionPublishStatus,
} from '../correction-flow.types';

/**
 * Maps the latest outbox row state to the GraphQL publish-status enum exposed to clients.
 */
export function derivePublishStatus(
  latestOutboxEntry: CorrectionEventOutboxRecord | null,
): CorrectionPublishStatus {
  if (!latestOutboxEntry) {
    return CORRECTION_PUBLISH_STATUS_NOT_QUEUED;
  }

  switch (latestOutboxEntry.status) {
    case CORRECTION_OUTBOX_STATUS_FAILED:
      return CORRECTION_PUBLISH_STATUS_FAILED;
    case CORRECTION_OUTBOX_STATUS_PENDING:
      return CORRECTION_PUBLISH_STATUS_PENDING;
    case CORRECTION_OUTBOX_STATUS_PUBLISHED:
      return CORRECTION_PUBLISH_STATUS_PUBLISHED;
    default:
      return CORRECTION_PUBLISH_STATUS_NOT_QUEUED;
  }
}
