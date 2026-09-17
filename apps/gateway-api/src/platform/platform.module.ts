import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PlatformClient } from './platform-client';
import { PlatformHttpTransport } from './platform-http-transport';

/** Supplies the gateway's sole client for Platform-owned behavior. */
@Module({
  exports: [PlatformClient],
  imports: [ConfigModule],
  providers: [PlatformHttpTransport, PlatformClient],
})
export class PlatformModule {}
