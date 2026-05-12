import { PersistenceDocument, SavePersistenceDocumentInput } from './persistence.types';

export interface PersistenceDocumentStore {
  getDocument(documentId: string): Promise<PersistenceDocument>;
  saveDocument(
    documentId: string,
    input: SavePersistenceDocumentInput,
  ): Promise<PersistenceDocument>;
}
