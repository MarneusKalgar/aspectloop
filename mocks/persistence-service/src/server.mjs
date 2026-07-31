import http from 'node:http';

import { createDocumentStore } from './storage/document-store.mjs';
import { createSeedDocuments } from './storage/seed-documents.mjs';
import { getDocumentId, isRecord, readJsonBody } from './utils/index.mjs';

const port = Number(process.env.PERSISTENCE_MOCK_PORT ?? 8090);
const documentStore = createDocumentStore();

try {
  await documentStore.seedDocuments(createSeedDocuments());
} catch (error) {
  console.error('Failed to initialize persistence mock storage', error);
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);

  res.setHeader('content-type', 'application/json');

  if (req.method === 'GET' && url.pathname === '/health') {
    res.end(JSON.stringify({ status: 'ok', service: 'persistence-mock' }));
    return;
  }

  const documentId = getDocumentId(url.pathname);

  if (req.method === 'GET' && documentId) {
    try {
      const document = await documentStore.readDocument(documentId);

      if (!document) {
        res.statusCode = 404;
        res.end(JSON.stringify({ message: `Document ${documentId} was not found` }));
        return;
      }

      res.end(JSON.stringify(document));
      return;
    } catch (error) {
      respondWithServerError(res, error);
      return;
    }
  }

  if (req.method === 'PUT' && documentId) {
    let body;

    try {
      body = await readJsonBody(req);
    } catch (error) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          message: error instanceof Error ? error.message : 'Invalid JSON payload',
        }),
      );
      return;
    }

    try {
      const existingDocument = await documentStore.readDocument(documentId);
      const nextDocumentType = body.documentType ?? existingDocument?.documentType;

      if (typeof nextDocumentType !== 'string' || !nextDocumentType) {
        res.statusCode = 400;
        res.end(JSON.stringify({ message: 'documentType is required for new documents' }));
        return;
      }

      if (!isRecord(body.payload)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ message: 'payload must be a JSON object' }));
        return;
      }

      const storedDocument = {
        documentId,
        documentType: nextDocumentType,
        payload: body.payload,
        updatedAt: new Date().toISOString(),
        version: (existingDocument?.version ?? 0) + 1,
      };

      await documentStore.writeDocument(documentId, storedDocument);
      res.end(JSON.stringify(storedDocument));
      return;
    } catch (error) {
      respondWithServerError(res, error);
      return;
    }
  }

  res.statusCode = 501;
  res.end(JSON.stringify({ message: 'Unsupported persistence mock route' }));
});

server.listen(port, () => {
  console.log(`Persistence mock listening on ${port}; data dir ${documentStore.dataDir}`);
});

function respondWithServerError(res, error) {
  console.error('Persistence mock storage error', error);
  res.statusCode = 500;
  res.end(
    JSON.stringify({
      message: error instanceof Error ? error.message : 'Persistence mock storage error',
    }),
  );
}
