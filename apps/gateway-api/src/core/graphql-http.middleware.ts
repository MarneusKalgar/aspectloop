/** Prevents caches from retaining authenticated GraphQL data or error responses. */
export function setGraphqlNoStore(
  _request: unknown,
  response: { setHeader(name: string, value: string): void },
  next: () => void,
): void {
  response.setHeader('Cache-Control', 'no-store');
  next();
}
