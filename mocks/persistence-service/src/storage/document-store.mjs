import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultDataDir = fileURLToPath(new URL('../../data/documents', import.meta.url));
const configuredDataDir = process.env.PERSISTENCE_MOCK_DATA_DIR ?? defaultDataDir;

export function createDocumentStore(options = {}) {
  const dataDir = options.dataDir ?? configuredDataDir;

  async function readDocument(documentId) {
    const filePath = getDocumentFilePath(dataDir, documentId);

    try {
      const fileContents = await readFile(filePath, 'utf8');
      return JSON.parse(fileContents);
    } catch (error) {
      if (isFileNotFound(error)) {
        return null;
      }

      throw new Error(
        `Failed to read document ${documentId} from ${filePath}: ${toErrorMessage(error)}`,
      );
    }
  }

  async function seedDocuments(documents) {
    await mkdir(dataDir, { recursive: true });

    for (const document of documents) {
      const existingDocument = await readDocument(document.documentId);

      if (existingDocument) {
        continue;
      }

      await writeDocument(document.documentId, document);
    }
  }

  async function writeDocument(documentId, document) {
    await mkdir(dataDir, { recursive: true });

    const filePath = getDocumentFilePath(dataDir, documentId);
    const tempFilePath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    const serializedDocument = `${JSON.stringify(document, null, 2)}\n`;

    try {
      await writeFile(tempFilePath, serializedDocument, 'utf8');
      await rename(tempFilePath, filePath);
    } catch (error) {
      throw new Error(
        `Failed to write document ${documentId} to ${filePath}: ${toErrorMessage(error)}`,
      );
    }
  }

  return {
    dataDir,
    readDocument,
    seedDocuments,
    writeDocument,
  };
}

function getDocumentFilePath(dataDir, documentId) {
  return path.join(dataDir, `${encodeURIComponent(documentId)}.json`);
}

function isFileNotFound(error) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}