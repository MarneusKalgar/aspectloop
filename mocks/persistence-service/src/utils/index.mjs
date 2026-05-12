export function getDocumentId(pathname) {
  const matchedPath = pathname.match(/^\/documents\/([^/]+)$/);
  return matchedPath ? decodeURIComponent(matchedPath[1]) : null;
}

export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}