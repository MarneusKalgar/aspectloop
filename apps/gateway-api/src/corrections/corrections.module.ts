import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { CorrectionSession } from '../correction-sessions/correction-session.entity';
import { CorrectionSessionsModule } from '../correction-sessions/correction-sessions.module';
import { DocumentRegistryModule } from '../document-registry/document-registry.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module';
import { CORRECTION_OUTBOX_RELAY_SERVICE, CORRECTION_PUBLISHER_SERVICE } from './constants';
import { CorrectionEdit, CorrectionEventOutbox } from './correction-edit.entity';
import { CorrectionsResolver } from './corrections.resolver';
import { CorrectionsService } from './corrections.service';
import { CorrectionOutboxRelayService } from './services/correction-outbox-relay.service';
import { CorrectionPublisherService } from './services/correction-publisher.service';
import { FlattenService } from './services/flatten.service';
import { MergeService } from './services/merge.service';

@Module({
  exports: [CorrectionsService, FlattenService, MergeService],
  imports: [
    TypeOrmModule.forFeature([CorrectionSession, CorrectionEdit, CorrectionEventOutbox]),
    AuthModule,
    CorrectionSessionsModule,
    DocumentRegistryModule,
    PersistenceModule,
    RabbitmqModule,
  ],
  providers: [
    CorrectionsResolver,
    CorrectionsService,
    FlattenService,
    MergeService,
    CorrectionOutboxRelayService,
    CorrectionPublisherService,
    {
      provide: CORRECTION_OUTBOX_RELAY_SERVICE,
      useExisting: CorrectionOutboxRelayService,
    },
    {
      provide: CORRECTION_PUBLISHER_SERVICE,
      useExisting: CorrectionPublisherService,
    },
  ],
})
export class CorrectionsModule {}
