import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  DEFAULT_PLATFORM_RESPONSE_POLICY,
  type PlatformResponsePolicy,
  type RejectedResponseBody,
} from './platform-response-policy';
import { MAX_PLATFORM_RESPONSE_BYTES, REQUEST_ID_PATTERN } from './platform.constants';
import {
  PlatformInvalidRequestException,
  PlatformInvalidResponseException,
  PlatformUnavailableException,
} from './platform.errors';

/** Describes a validated GET route and its caller-independent diagnostic template. */
export interface PlatformGetEndpoint<TOutput> {
  /** Fixed route template; never include caller-supplied path segments. */
  logRoute: string;
  path: string;
  responsePolicy?: PlatformResponsePolicy;
  responseSchema: RuntimeSchema<TOutput>;
}

/** Describes a validated POST route and its command/response contracts. */
export interface PlatformPostEndpoint<TInput, TOutput> extends PlatformGetEndpoint<TOutput> {
  requestSchema: RuntimeSchema<TInput>;
}

/** Carries only gateway metadata that is safe to forward to Platform. */
export interface PlatformRequestContext {
  requestId?: string;
}

type PlatformRequestMethod = 'GET' | 'POST';

interface RuntimeSchema<T> {
  safeParse(value: unknown): { data: T; success: true } | { success: false };
}

/**
 * Enforces the internal Platform HTTP boundary for the gateway.
 *
 * It bounds response size and duration, validates both directions against
 * shared runtime schemas, forwards only validated request IDs, and converts
 * upstream failures into stable gateway exceptions without exposing bodies.
 */
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
    return this.request('GET', endpoint, context);
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

    return this.request('POST', endpoint, context, parsedInput.data);
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

  /** Classifies a rejected body after at most one bounded read. */
  private async readRejectedBody(response: Response): Promise<RejectedResponseBody> {
    try {
      return { readable: true, value: await this.readBoundedJson(response) };
    } catch (error) {
      if (error instanceof PlatformInvalidResponseException) {
        return { readable: false };
      }

      throw error;
    }
  }

  /** Performs a bounded request and logs only the endpoint's fixed route template. */
  private async request<TOutput>(
    method: PlatformRequestMethod,
    endpoint: PlatformGetEndpoint<TOutput>,
    context: PlatformRequestContext,
    body?: unknown,
  ): Promise<TOutput> {
    let response: Response;
    const responsePolicy = endpoint.responsePolicy ?? DEFAULT_PLATFORM_RESPONSE_POLICY;

    try {
      const headers = this.getHeaders(context);
      if (body !== undefined) {
        headers.set('content-type', 'application/json');
      }

      response = await fetch(`${this.baseUrl}${endpoint.path}`, {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers,
        method,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      this.logger.error({
        event: 'platform.request.failed',
        outcome: 'failure',
        path: endpoint.logRoute,
        reason: error instanceof Error ? error.name : 'unknown',
      });
      throw new PlatformUnavailableException();
    }

    if (!response.ok) {
      this.logger.warn({
        event: 'platform.request.failed',
        outcome: 'failure',
        path: endpoint.logRoute,
        reason: 'upstream_status',
        upstreamStatus: response.status,
      });
      const body = responsePolicy.readsRejectedBody(response.status)
        ? await this.readRejectedBody(response)
        : { readable: false as const };
      throw responsePolicy.mapRejectedResponse(response.status, body);
    }

    let payload: unknown;

    try {
      payload = await this.readBoundedJson(response);
    } catch (error) {
      if (error instanceof PlatformInvalidResponseException) {
        throw responsePolicy.invalidSuccessResponse();
      }

      throw error;
    }

    const parsed = endpoint.responseSchema.safeParse(payload);

    if (!parsed.success) {
      this.logger.error({
        event: 'platform.response.invalid',
        outcome: 'failure',
        path: endpoint.logRoute,
      });
      throw responsePolicy.invalidSuccessResponse();
    }

    return parsed.data;
  }
}
