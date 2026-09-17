import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ArtifactStorageModule } from '../storage/artifact-storage.module';
import { DocumentObjectReservation } from './model/document-object-reservation.entity';
import { DocumentObject } from './model/document-object.entity';
import { Document } from './model/document.entity';
import { TypeOrmSourceObjectReservationStore } from './source-object/reservation/typeorm-source-object-reservation.store';
import { SourceObjectCoordinator } from './source-object/source-object-coordinator';
import { SOURCE_OBJECT_RESERVATION_STORE } from './source-object/source-object-reservation.types';

/** Wires Platform document metadata, reservation state, and artifact storage. */
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
