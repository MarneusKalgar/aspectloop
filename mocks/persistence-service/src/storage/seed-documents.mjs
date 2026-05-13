export function createSeedDocuments() {
  return [
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
  ];
}