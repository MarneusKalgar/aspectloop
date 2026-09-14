import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ArtifactStorageModule } from '../storage/artifact-storage.module';
import { DocumentObjectReservation } from './document-object-reservation.entity';
import { DocumentObject } from './document-object.entity';
import { Document } from './document.entity';
import { SourceObjectCoordinator } from './source-object-coordinator';
import { SOURCE_OBJECT_RESERVATION_STORE } from './source-object-reservation.types';
import { TypeOrmSourceObjectReservationStore } from './typeorm-source-object-reservation.store';

@Module({
  exports: [ArtifactStorageModule, SourceObjectCoordinator, TypeOrmModule],
  imports: [
    TypeOrmModule.forFeature([Document, DocumentObject, DocumentObjectReservation]),
    ArtifactStorageModule,
  ],
  providers: [
    SourceObjectCoordinator,
    {
      provide: SOURCE_OBJECT_RESERVATION_STORE,
      useClass: TypeOrmSourceObjectReservationStore,
    },
  ],
})
export class DocumentsModule {}
