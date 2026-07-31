import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RabbitmqService } from './rabbitmq.service';

@Module({
  exports: [RabbitmqService],
  imports: [ConfigModule],
  providers: [RabbitmqService],
})
export class RabbitmqModule {}
