import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { DocumentRegistryModule } from '../document-registry/document-registry.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { CorrectionSession } from './correction-session.entity';
import { CorrectionSessionsResolver } from './correction-sessions.resolver';
import { CorrectionSessionsService } from './correction-sessions.service';

@Module({
  exports: [CorrectionSessionsService],
  imports: [
    TypeOrmModule.forFeature([CorrectionSession]),
    AuthModule,
    DocumentRegistryModule,
    PersistenceModule,
  ],
  providers: [CorrectionSessionsResolver, CorrectionSessionsService],
})
export class CorrectionSessionsModule {}
