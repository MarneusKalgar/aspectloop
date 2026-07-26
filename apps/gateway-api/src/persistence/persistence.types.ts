export interface PersistenceDocument {
  documentId: string;
  documentType: string;
  payload: Record<string, unknown>;
  updatedAt: string;
  version: number;
}

export interface SavePersistenceDocumentInput {
  documentType: string;
  payload: Record<string, unknown>;
}
