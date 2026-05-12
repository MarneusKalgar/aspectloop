import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ChannelModel, connect, Options } from 'amqplib';

import { PublishToQueueInput } from './rabbitmq.types';

@Injectable()
export class RabbitmqService implements OnModuleDestroy, OnModuleInit {
  private channel: Channel | null = null;
  private connection: ChannelModel | null = null;
  private readonly logger = new Logger(RabbitmqService.name);

  constructor(private readonly configService: ConfigService) {}

  async assertQueue(queueName: string, options?: Options.AssertQueue): Promise<void> {
    const channel = this.getChannel();
    await channel.assertQueue(queueName, options);
  }

  isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async publishToQueue(input: PublishToQueueInput): Promise<void> {
    const channel = this.getChannel();
    await channel.assertQueue(input.queueName, { durable: true });
    const published = channel.sendToQueue(
      input.queueName,
      Buffer.isBuffer(input.message) ? input.message : Buffer.from(input.message),
      {
        persistent: input.options?.persistent ?? true,
      },
    );

    if (!published) {
      this.logger.warn(
        `Failed to publish message to queue "${input.queueName}". Channel buffer full.`,
      );
    }
  }

  private async connect(): Promise<void> {
    try {
      this.connection = await connect({
        hostname: this.configService.getOrThrow<string>('RABBITMQ_HOST'),
        password: this.configService.getOrThrow<string>('RABBITMQ_PASSWORD'),
        port: this.configService.get<number>('RABBITMQ_PORT') ?? 5672,
        username: this.configService.getOrThrow<string>('RABBITMQ_USER'),
      });

      this.channel = await this.connection.createChannel();

      this.connection.on('error', (error: unknown) => {
        this.logger.error(
          'RabbitMQ connection error',
          error instanceof Error ? error.stack : String(error),
        );
      });

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
        this.channel = null;
        this.connection = null;
      });

      this.logger.log('RabbitMQ connected successfully');
    } catch (error) {
      this.logger.error(
        'Failed to connect to RabbitMQ',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      this.logger.log('RabbitMQ disconnected successfully');
    } catch (error) {
      this.logger.error(
        'Error disconnecting from RabbitMQ',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private getChannel(): Channel {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized');
    }

    return this.channel;
  }
}
