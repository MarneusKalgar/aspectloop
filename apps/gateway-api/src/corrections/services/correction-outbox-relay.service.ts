import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CORRECTION_PUBLISHER_SERVICE } from '../constants';
import { CorrectionEventOutbox } from '../correction-edit.entity';
import {
  CORRECTION_OUTBOX_STATUS_FAILED,
  CORRECTION_OUTBOX_STATUS_PENDING,
  CORRECTION_OUTBOX_STATUS_PUBLISHED,
} from '../correction-flow.types';

interface CorrectionPublisherPort {
  publishCorrectedDocumentEvent(event: Record<string, unknown>, messageId: string): Promise<void>;
}

@Injectable()
/**
 * Periodically relays pending correction outbox rows to RabbitMQ and records the result.
 */
export class CorrectionOutboxRelayService implements OnModuleDestroy, OnModuleInit {
  private readonly flushIntervalMs: number;
  private isFlushing = false;
  private readonly logger = new Logger(CorrectionOutboxRelayService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(CorrectionEventOutbox)
    private readonly correctionEventOutboxRepository: Repository<CorrectionEventOutbox>,
    private readonly configService: ConfigService,
    @Inject(CORRECTION_PUBLISHER_SERVICE)
    private readonly correctionPublisherService: CorrectionPublisherPort,
  ) {
    this.flushIntervalMs =
      this.configService.get<number>('CORRECTION_OUTBOX_FLUSH_INTERVAL_MS') ?? 5000;
  }

  /**
   * Flushes a specific set of outbox rows, typically immediately after the submit
   * transaction commits.
   */
  async flushOutboxByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const rows = await this.correctionEventOutboxRepository.find({
      order: { createdAt: 'ASC' },
      where: ids.map((id) => ({ id })),
    });

    for (const row of rows) {
      if (row.status === CORRECTION_OUTBOX_STATUS_PUBLISHED) {
        continue;
      }

      await this.flushRow(row);
    }
  }

  /**
   * Stops the periodic relay timer when the module is torn down.
   */
  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Starts the periodic pending-outbox scan for in-process relay delivery.
   */
  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.flushPendingOutbox();
    }, this.flushIntervalMs);
    this.timer.unref();
  }

  /**
   * Scans the oldest pending or failed outbox rows and attempts to publish them.
   */
  private async flushPendingOutbox(): Promise<void> {
    if (this.isFlushing) {
      return;
    }

    this.isFlushing = true;

    try {
      const pendingRows = await this.correctionEventOutboxRepository
        .createQueryBuilder('outbox')
        .where('outbox.status IN (:...statuses)', {
          statuses: [CORRECTION_OUTBOX_STATUS_PENDING, CORRECTION_OUTBOX_STATUS_FAILED],
        })
        .orderBy('outbox.createdAt', 'ASC')
        .take(20)
        .getMany();

      for (const row of pendingRows) {
        await this.flushRow(row);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Publishes one outbox row and updates retry state based on the result.
   */
  private async flushRow(row: CorrectionEventOutbox): Promise<void> {
    try {
      await this.correctionPublisherService.publishCorrectedDocumentEvent(row.payload, row.id);

      row.lastError = null;
      row.publishedAt = new Date();
      row.status = CORRECTION_OUTBOX_STATUS_PUBLISHED;

      await this.correctionEventOutboxRepository.save(row);
    } catch (error) {
      row.attempts += 1;
      row.lastError = error instanceof Error ? error.message : String(error);
      row.status = CORRECTION_OUTBOX_STATUS_FAILED;

      await this.correctionEventOutboxRepository.save(row);

      this.logger.warn(`Failed to publish correction outbox ${row.id}: ${row.lastError}`);
    }
  }
}
