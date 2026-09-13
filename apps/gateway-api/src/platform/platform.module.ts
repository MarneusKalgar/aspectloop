import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PlatformClient } from './platform-client';
import { PlatformHttpTransport } from './platform-http-transport';

@Module({
  exports: [PlatformClient],
  imports: [ConfigModule],
  providers: [PlatformHttpTransport, PlatformClient],
})
export class PlatformModule {}
