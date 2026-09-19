import type {
  PlatformDocumentTypeResponse,
  PlatformDocumentTypesResponse,
} from '@aspectloop/contracts/platform';

import {
  PLATFORM_INTERNAL_API_PREFIX,
  platformDocumentTypeResponseSchema,
  platformDocumentTypesResponseSchema,
} from '@aspectloop/contracts/platform';
import { Controller, Get, Param } from '@nestjs/common';

import { DocumentRegistryService } from './document-registry.service';

@Controller(`${PLATFORM_INTERNAL_API_PREFIX.slice(1)}/document-types`)
export class DocumentRegistryController {
  /** Creates the internal document-registry transport boundary. */
  constructor(private readonly documentRegistryService: DocumentRegistryService) {}

  /** Returns one complete document-type configuration. */
  @Get(':documentType')
  getDocumentType(@Param('documentType') documentType: string): PlatformDocumentTypeResponse {
    return platformDocumentTypeResponseSchema.parse({
      documentType: this.documentRegistryService.getDocumentTypeOrThrow(documentType),
    });
  }

  /** Returns bounded document-type summaries in stable label order. */
  @Get()
  listDocumentTypes(): PlatformDocumentTypesResponse {
    return platformDocumentTypesResponseSchema.parse({
      documentTypes: this.documentRegistryService.listDocumentTypes(),
    });
  }
}
