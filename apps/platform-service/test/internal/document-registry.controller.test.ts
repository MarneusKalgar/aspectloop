import type { PlatformDocumentTypeConfig } from '@aspectloop/contracts/platform';

import { expect, test, vi } from 'vitest';

import type { DocumentRegistryService } from '../../src/document-registry/document-registry.service';

import { DocumentRegistryController } from '../../src/document-registry/document-registry.controller';
const CONFIG: PlatformDocumentTypeConfig = {
  label: 'Supplier invoice',
  sections: [
    {
      fields: [
        {
          id: 'invoiceNumber',
          inputType: 'text',
          label: 'Invoice number',
          path: 'header.invoiceNumber',
        },
      ],
      id: 'header',
      label: 'Header',
      path: 'header',
      repeatable: false,
    },
  ],
  type: 'supplier_invoice',
  version: 1,
};

/** Verifies complete registry entries are wrapped in the shared response contract. */
function testDocumentType(): void {
  const getDocumentTypeOrThrow = vi.fn().mockReturnValue(CONFIG);
  const controller = new DocumentRegistryController({
    getDocumentTypeOrThrow,
  } as unknown as DocumentRegistryService);

  expect(controller.getDocumentType(CONFIG.type)).toEqual({ documentType: CONFIG });
  expect(getDocumentTypeOrThrow).toHaveBeenCalledWith(CONFIG.type);
}

/** Verifies registry summaries remain sorted by the owning service. */
function testDocumentTypes(): void {
  const listDocumentTypes = vi
    .fn()
    .mockReturnValue([{ label: CONFIG.label, type: CONFIG.type, version: CONFIG.version }]);
  const controller = new DocumentRegistryController({
    listDocumentTypes,
  } as unknown as DocumentRegistryService);

  expect(controller.listDocumentTypes()).toEqual({
    documentTypes: [{ label: CONFIG.label, type: CONFIG.type, version: CONFIG.version }],
  });
}

test('returns a contracted internal document type', testDocumentType);
test('returns contracted internal document type summaries', testDocumentTypes);
