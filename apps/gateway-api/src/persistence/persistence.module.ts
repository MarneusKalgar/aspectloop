import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PersistenceClient } from './persistence.client';

@Module({
  exports: [PersistenceClient],
  imports: [ConfigModule],
  providers: [PersistenceClient],
})
export class PersistenceModule {}
