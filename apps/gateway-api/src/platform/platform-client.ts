import type {
  PlatformHealthResponse,
  PlatformReadinessResponse,
} from '@aspectloop/contracts/platform';

import {
  PLATFORM_INTERNAL_ROUTES,
  platformHealthResponseSchema,
  platformReadinessResponseSchema,
} from '@aspectloop/contracts/platform';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MAX_PLATFORM_RESPONSE_BYTES, REQUEST_ID_PATTERN } from './platform.constants';
import {
  PlatformInvalidResponseException,
  PlatformRequestFailedException,
  PlatformUnavailableException,
} from './platform.errors';

export interface PlatformRequestContext {
  requestId?: string;
}

interface RuntimeSchema<T> {
  safeParse(value: unknown): { data: T; success: true } | { success: false };
}

@Injectable()
export class PlatformClient {
  private readonly baseUrl: string;
  private readonly logger = new Logger(PlatformClient.name);
  private readonly timeoutMs: number;

  /** Creates a bounded client from validated gateway configuration. */
  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.getOrThrow<string>('PLATFORM_BASE_URL').replace(/\/+$/, '');
    this.timeoutMs = this.configService.get<number>('PLATFORM_REQUEST_TIMEOUT_MS') ?? 5000;
  }

  /** Reads Platform process liveness through the versioned internal boundary. */
  async getHealth(context: PlatformRequestContext = {}): Promise<PlatformHealthResponse> {
    return this.get(PLATFORM_INTERNAL_ROUTES.health, platformHealthResponseSchema, context);
  }

  /** Reads Platform dependency readiness through the versioned internal boundary. */
  async getReadiness(context: PlatformRequestContext = {}): Promise<PlatformReadinessResponse> {
    return this.get(PLATFORM_INTERNAL_ROUTES.readiness, platformReadinessResponseSchema, context);
  }

  /** Performs a bounded GET and validates the response against its shared runtime schema. */
  private async get<T>(
    path: string,
    schema: RuntimeSchema<T>,
    context: PlatformRequestContext,
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        headers: this.getHeaders(context),
        method: 'GET',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      this.logger.error({
        event: 'platform.request.failed',
        outcome: 'failure',
        path,
        reason: error instanceof Error ? error.name : 'unknown',
      });
      throw new PlatformUnavailableException();
    }

    if (!response.ok) {
      this.logger.warn({
        event: 'platform.request.failed',
        outcome: 'failure',
        path,
        reason: 'upstream_status',
        upstreamStatus: response.status,
      });
      throw new PlatformRequestFailedException(response.status);
    }

    const payload = await this.readBoundedJson(response);
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      this.logger.error({
        event: 'platform.response.invalid',
        outcome: 'failure',
        path,
      });
      throw new PlatformInvalidResponseException();
    }

    return parsed.data;
  }

  /** Builds caller headers without forwarding unsafe correlation input. */
  private getHeaders(context: PlatformRequestContext): Headers {
    const headers = new Headers({ accept: 'application/json' });

    if (context.requestId && REQUEST_ID_PATTERN.test(context.requestId)) {
      headers.set('x-request-id', context.requestId);
    }

    return headers;
  }

  /** Reads and parses a response body while enforcing the internal payload limit. */
  private async readBoundedJson(response: Response): Promise<unknown> {
    const contentLength = Number(response.headers.get('content-length'));

    if (Number.isFinite(contentLength) && contentLength > MAX_PLATFORM_RESPONSE_BYTES) {
      throw new PlatformInvalidResponseException();
    }

    const responseBody = response.body;

    if (!responseBody) {
      throw new PlatformInvalidResponseException();
    }

    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    try {
      for await (const chunk of responseBody) {
        receivedBytes += chunk.byteLength;
        if (receivedBytes > MAX_PLATFORM_RESPONSE_BYTES) {
          throw new PlatformInvalidResponseException();
        }

        chunks.push(chunk);
      }

      return JSON.parse(Buffer.concat(chunks, receivedBytes).toString('utf8')) as unknown;
    } catch (error) {
      if (error instanceof PlatformInvalidResponseException) {
        throw error;
      }

      throw new PlatformInvalidResponseException();
    }
  }
}
