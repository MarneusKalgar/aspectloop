import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { BrowserSessionPlatformClient } from './browser-session-platform-client';
import { PlatformClient } from './platform-client';
import { PlatformHttpTransport } from './platform-http-transport';

/** Supplies the gateway's sole client for Platform-owned behavior. */
@Module({
  exports: [BrowserSessionPlatformClient, PlatformClient],
  imports: [ConfigModule],
  providers: [PlatformHttpTransport, BrowserSessionPlatformClient, PlatformClient],
})
export class PlatformModule {}
