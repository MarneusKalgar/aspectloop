import type {
  PlatformDocumentTypeConfig,
  PlatformDocumentTypeSummary,
} from '@aspectloop/contracts/platform';

import { Injectable } from '@nestjs/common';

import type { PlatformRequestContext } from '../platform/platform-client';

import { PlatformClient } from '../platform/platform-client';

@Injectable()
export class DocumentRegistryService {
  private readonly documentTypes = new Map<string, Promise<PlatformDocumentTypeConfig>>();

  /** Creates the gateway adapter for Platform-owned registry behavior. */
  constructor(private readonly platformClient: PlatformClient) {}

  /** Reads one complete document-type configuration from Platform. */
  async getDocumentTypeOrThrow(
    type: string,
    context: PlatformRequestContext = {},
  ): Promise<PlatformDocumentTypeConfig> {
    const cached = this.documentTypes.get(type);

    if (cached) {
      return cached;
    }

    const pending = this.platformClient
      .getDocumentType(type, context)
      .then(({ documentType }) => documentType)
      .catch((error: unknown) => {
        this.documentTypes.delete(type);
        throw error;
      });
    this.documentTypes.set(type, pending);

    return pending;
  }

  /** Reads the public document-type summaries from Platform. */
  async listDocumentTypes(
    context: PlatformRequestContext = {},
  ): Promise<PlatformDocumentTypeSummary[]> {
    const { documentTypes } = await this.platformClient.listDocumentTypes(context);

    return documentTypes;
  }
}
