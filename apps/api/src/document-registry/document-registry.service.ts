import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DocumentTypeConfig, DocumentTypeSummary } from './document-registry.types';
import { validateDocumentTypeConfig } from './document-registry.validation';

@Injectable()
export class DocumentRegistryService implements OnModuleInit {
  private readonly documentTypes = new Map<string, DocumentTypeConfig>();
  private readonly logger = new Logger(DocumentRegistryService.name);

  getDocumentTypeOrThrow(type: string): DocumentTypeConfig {
    const config = this.documentTypes.get(type);

    if (!config) {
      throw new NotFoundException(`Unsupported document type: ${type}`);
    }

    return config;
  }

  listDocumentTypes(): DocumentTypeSummary[] {
    return [...this.documentTypes.values()]
      .map((config) => ({ label: config.label, type: config.type, version: config.version }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }

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
