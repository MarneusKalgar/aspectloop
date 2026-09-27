import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { BrowserSessionPlatformClient } from '#app/platform/browser-session-platform-client';

import { PlatformModule } from '../platform/platform.module';
import { AuthResolver } from './auth.resolver';
import { BrowserSessionGuard } from './guards/browser-session.guard';
import { RolesGuard } from './guards/roles.guard';
import { ScopesGuard } from './guards/scopes.guard';
import { BrowserSessionAuthenticationService } from './session/browser-session-authentication.service';
import { BrowserSessionCookieAdapter } from './session/browser-session-cookie.adapter';
import { BrowserSessionService } from './session/browser-session.service';

@Module({
  exports: [BrowserSessionGuard, RolesGuard, ScopesGuard],
  imports: [ConfigModule, PlatformModule],
  providers: [
    AuthResolver,
    BrowserSessionGuard,
    RolesGuard,
    ScopesGuard,
    {
      provide: APP_GUARD,
      useExisting: BrowserSessionGuard,
    },
    {
      inject: [ConfigService],
      provide: BrowserSessionCookieAdapter,
      /** Uses validated runtime mode for the cookie's Secure attribute. */
      useFactory: (config: ConfigService) =>
        new BrowserSessionCookieAdapter(config.getOrThrow<string>('NODE_ENV')),
    },
    {
      inject: [BrowserSessionPlatformClient, BrowserSessionCookieAdapter],
      provide: BrowserSessionService,
      /** Coordinates the single Platform adapter with Gateway cookie ownership. */
      useFactory: (platform: BrowserSessionPlatformClient, cookie: BrowserSessionCookieAdapter) =>
        new BrowserSessionService(platform, cookie),
    },
    {
      inject: [BrowserSessionPlatformClient, BrowserSessionCookieAdapter],
      provide: BrowserSessionAuthenticationService,
      /** Shares authoritative validation only within one original request. */
      useFactory: (platform: BrowserSessionPlatformClient, cookie: BrowserSessionCookieAdapter) =>
        new BrowserSessionAuthenticationService(platform, cookie),
    },
  ],
})
export class AuthModule {}
