import http from 'node:http';

import { getDocumentId, isRecord, readJsonBody } from './utils/index.mjs';

const port = Number(process.env.PERSISTENCE_MOCK_PORT ?? 8090);

const documents = new Map([
  [
    'demo-invoice-001',
    {
      documentId: 'demo-invoice-001',
      documentType: 'supplier_invoice',
      version: 1,
      payload: {
        header: {
          invoiceDate: '2026-05-01',
          invoiceNumber: 'INV-2026-001',
          supplierName: 'Acme Supplies',
        },
        totals: {
          grossAmount: 1250.42,
          netAmount: 1000.34,
          taxAmount: 250.08,
        },
      },
      updatedAt: new Date().toISOString(),
    },
  ],
]);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);

  res.setHeader('content-type', 'application/json');

  if (req.method === 'GET' && url.pathname === '/health') {
    res.end(JSON.stringify({ status: 'ok', service: 'persistence-mock' }));
    return;
  }

  const documentId = getDocumentId(url.pathname);

  if (req.method === 'GET' && documentId) {
    const document = documents.get(documentId);

    if (!document) {
      res.statusCode = 404;
      res.end(JSON.stringify({ message: `Document ${documentId} was not found` }));
      return;
    }

    res.end(JSON.stringify(document));
    return;
  }

  if (req.method === 'PUT' && documentId) {
    try {
      const body = await readJsonBody(req);
      const existingDocument = documents.get(documentId);
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

      documents.set(documentId, storedDocument);
      res.end(JSON.stringify(storedDocument));
      return;
    } catch (error) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          message: error instanceof Error ? error.message : 'Invalid JSON payload',
        }),
      );
      return;
    }
  }

  res.statusCode = 501;
  res.end(JSON.stringify({ message: 'Unsupported persistence mock route' }));
});

server.listen(port, () => {
  console.log(`Persistence mock listening on ${port}`);
});