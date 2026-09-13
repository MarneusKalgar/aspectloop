import { platformErrorResponseSchema } from '@aspectloop/contracts/platform';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MAX_PLATFORM_RESPONSE_BYTES, REQUEST_ID_PATTERN } from './platform.constants';
import {
  PlatformInvalidRequestException,
  PlatformInvalidResponseException,
  PlatformRejectedRequestException,
  PlatformRequestFailedException,
  PlatformUnavailableException,
} from './platform.errors';

export interface PlatformGetEndpoint<TOutput> {
  path: string;
  responseSchema: RuntimeSchema<TOutput>;
}

export interface PlatformPostEndpoint<TInput, TOutput> extends PlatformGetEndpoint<TOutput> {
  requestSchema: RuntimeSchema<TInput>;
}

export interface PlatformRequestContext {
  requestId?: string;
}

type PlatformRequestMethod = 'GET' | 'POST';

interface RuntimeSchema<T> {
  safeParse(value: unknown): { data: T; success: true } | { success: false };
}

const FORWARDABLE_PLATFORM_STATUSES = new Set([400, 401, 403, 404, 409]);

@Injectable()
export class PlatformHttpTransport {
  private readonly baseUrl: string;
  private readonly logger = new Logger(PlatformHttpTransport.name);
  private readonly timeoutMs: number;

  /** Creates a bounded transport from validated gateway configuration. */
  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.getOrThrow<string>('PLATFORM_BASE_URL').replace(/\/+$/, '');
    this.timeoutMs = this.configService.get<number>('PLATFORM_REQUEST_TIMEOUT_MS') ?? 5000;
  }

  /** Sends a bounded GET request described by a typed Platform endpoint. */
  async get<TOutput>(
    endpoint: PlatformGetEndpoint<TOutput>,
    context: PlatformRequestContext,
  ): Promise<TOutput> {
    return this.request('GET', endpoint.path, endpoint.responseSchema, context);
  }

  /** Validates and sends a bounded POST request described by a typed Platform endpoint. */
  async post<TInput, TOutput>(
    endpoint: PlatformPostEndpoint<TInput, TOutput>,
    input: TInput,
    context: PlatformRequestContext,
  ): Promise<TOutput> {
    const parsedInput = endpoint.requestSchema.safeParse(input);

    if (!parsedInput.success) {
      throw new PlatformInvalidRequestException();
    }

    return this.request('POST', endpoint.path, endpoint.responseSchema, context, parsedInput.data);
  }

  /** Builds caller headers without forwarding unsafe correlation input. */
  private getHeaders(context: PlatformRequestContext): Headers {
    const headers = new Headers({ accept: 'application/json' });

    if (context.requestId && REQUEST_ID_PATTERN.test(context.requestId)) {
      headers.set('x-request-id', context.requestId);
    }

    return headers;
  }

  /** Maps only validated expected Platform failures through the public boundary. */
  private async mapRejectedResponse(response: Response): Promise<Error> {
    if (!FORWARDABLE_PLATFORM_STATUSES.has(response.status)) {
      return new PlatformRequestFailedException(response.status);
    }

    try {
      const parsed = platformErrorResponseSchema.safeParse(await this.readBoundedJson(response));

      if (!parsed.success || parsed.data.statusCode !== response.status) {
        return new PlatformRequestFailedException(response.status);
      }

      const message = Array.isArray(parsed.data.message)
        ? parsed.data.message.join(', ')
        : parsed.data.message;

      return new PlatformRejectedRequestException(message, response.status);
    } catch {
      return new PlatformRequestFailedException(response.status);
    }
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

  /** Performs a bounded request and validates the response against its runtime schema. */
  private async request<TOutput>(
    method: PlatformRequestMethod,
    path: string,
    schema: RuntimeSchema<TOutput>,
    context: PlatformRequestContext,
    body?: unknown,
  ): Promise<TOutput> {
    let response: Response;

    try {
      const headers = this.getHeaders(context);
      if (body !== undefined) {
        headers.set('content-type', 'application/json');
      }

      response = await fetch(`${this.baseUrl}${path}`, {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers,
        method,
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
      throw await this.mapRejectedResponse(response);
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
}
