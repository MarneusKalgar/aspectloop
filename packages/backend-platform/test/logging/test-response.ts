export class TestResponse {
  headers = new Map<string, string>();
  statusCode = 200;

  /**
   * Captures a response header written by request-ID generation.
   *
   * @param name Response header name.
   * @param value Response header value.
   */
  setHeader(name: string, value: number | readonly string[] | string): void {
    this.headers.set(name.toLowerCase(), String(value));
  }
}
