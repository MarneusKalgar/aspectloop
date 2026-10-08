import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { BoundedMailDispatcher } from './dispatch/bounded-mail-dispatcher';
import { MAIL_DISPATCHER } from './mail.port';
import { SmtpMailTransport } from './smtp/smtp-mail-transport';

@Module({
  exports: [MAIL_DISPATCHER],
  imports: [ConfigModule],
  providers: [{ inject: [ConfigService], provide: MAIL_DISPATCHER, useFactory: createDispatcher }],
})
export class MailModule {}

/** Wires transport and lifecycle ownership without probing SMTP during startup/readiness. */
export function createDispatcher(config: ConfigService): BoundedMailDispatcher {
  const logger = new Logger('PlatformMail');
  const transport = new SmtpMailTransport({
    from: config.getOrThrow<string>('SMTP_FROM'),
    host: config.getOrThrow<string>('SMTP_HOST'),
    password: config.get<string>('SMTP_PASSWORD'),
    port: config.getOrThrow<number>('SMTP_PORT'),
    secure: config.getOrThrow<string>('SMTP_SECURE') === 'true',
    user: config.get<string>('SMTP_USER'),
  });

  return new BoundedMailDispatcher(
    transport,
    /** Logs only a repository-defined category, never a payload or provider exception. */
    (category) => logger.warn(`mail:${category}`),
  );
}
