import { Module } from '@nestjs/common';

import { DocumentRegistryController } from './document-registry.controller';
import { DocumentRegistryService } from './document-registry.service';

@Module({
  controllers: [DocumentRegistryController],
  exports: [DocumentRegistryService],
  providers: [DocumentRegistryService],
})
export class DocumentRegistryModule {}
