import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PlatformModule } from '../platform/platform.module';
import { DocumentRegistryService } from './document-registry.service';
import { DocumentTypesResolver } from './document-types.resolver';

@Module({
  exports: [DocumentRegistryService],
  imports: [AuthModule, PlatformModule],
  providers: [DocumentRegistryService, DocumentTypesResolver],
})
export class DocumentRegistryModule {}
