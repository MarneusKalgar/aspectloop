import { RabbitmqService } from '@app/rabbitmq/rabbitmq.service';
import { Injectable } from '@nestjs/common';

import { CORRECTION_EVENTS_QUEUE } from '../constants';
import { CORRECTION_OUTBOX_EVENT_TYPE_DOCUMENT_CORRECTED } from '../correction-flow.types';

@Injectable()
/**
 * Publishes corrected-document events onto the correction events queue.
 */
export class CorrectionPublisherService {
  constructor(private readonly rabbitmqService: RabbitmqService) {}

  /**
   * Sends a serialized corrected-document event with durable queue metadata.
   */
  async publishCorrectedDocumentEvent(
    event: Record<string, unknown>,
    messageId: string,
  ): Promise<void> {
    await this.rabbitmqService.publishToQueue({
      message: JSON.stringify(event),
      options: {
        contentType: 'application/json',
        messageId,
        persistent: true,
        type: CORRECTION_OUTBOX_EVENT_TYPE_DOCUMENT_CORRECTED,
      },
      queueName: CORRECTION_EVENTS_QUEUE,
    });
  }
}
