import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { DocumentTypeConfig, DocumentTypeSummary } from './document-registry.types';

import { validateDocumentTypeConfig } from './document-registry.validation';

/** Loads and exposes the Platform-owned document-type registry at startup. */
@Injectable()
export class DocumentRegistryService implements OnModuleInit {
  private readonly documentTypes = new Map<string, DocumentTypeConfig>();
  private readonly logger = new Logger(DocumentRegistryService.name);

  /**
   * Resolves one configured Platform document type.
   *
   * @param type Stable type key requested through the internal contract.
   * @returns The validated registry configuration.
   * @throws {NotFoundException} When no configuration owns the requested type.
   */
  getDocumentTypeOrThrow(type: string): DocumentTypeConfig {
    const config = this.documentTypes.get(type);

    if (!config) {
      throw new NotFoundException(`Unsupported document type: ${type}`);
    }

    return config;
  }

  /**
   * Lists stable summaries without exposing registry implementation details.
   *
   * @returns Label-sorted document type summaries.
   */
  listDocumentTypes(): DocumentTypeSummary[] {
    return [...this.documentTypes.values()]
      .map((config) => ({ label: config.label, type: config.type, version: config.version }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  /**
   * Loads every repository-owned registry file before the service accepts traffic.
   *
   * @returns Nothing; startup fails closed for invalid, duplicate, or empty registry state.
   */
  onModuleInit(): void {
    const configDirectory = join(__dirname, 'configs');
    const configFiles = readdirSync(configDirectory).filter((fileName) =>
      fileName.endsWith('.json'),
    );

    for (const fileName of configFiles) {
      const filePath = join(configDirectory, fileName);
      const parsedConfig = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
      const config = validateDocumentTypeConfig(parsedConfig);

      if (this.documentTypes.has(config.type)) {
        throw new Error(`Duplicate document type config detected: ${config.type}`);
      }

      this.documentTypes.set(config.type, config);
      this.logger.log(`Loaded document type config ${config.type} from ${fileName}`);
    }

    if (this.documentTypes.size === 0) {
      throw new Error('No document type configs were loaded');
    }

    this.logger.log(`Document registry initialized with ${this.documentTypes.size} type(s)`);
  }
}
