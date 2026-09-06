import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ArtifactStorageModule } from '../storage/artifact-storage.module';
import { DocumentObject } from './document-object.entity';
import { Document } from './document.entity';

@Module({
  exports: [ArtifactStorageModule, TypeOrmModule],
  imports: [TypeOrmModule.forFeature([Document, DocumentObject]), ArtifactStorageModule],
})
export class DocumentsModule {}
