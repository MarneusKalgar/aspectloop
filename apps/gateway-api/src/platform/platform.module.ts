import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PlatformClient } from './platform-client';

@Module({
  exports: [PlatformClient],
  imports: [ConfigModule],
  providers: [PlatformClient],
})
export class PlatformModule {}
