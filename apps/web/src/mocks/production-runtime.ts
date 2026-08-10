export const worker = {
  /**
   * Resolves without registering a service worker in production bundles.
   *
   * @returns A resolved promise.
   */
  start(): Promise<void> {
    return Promise.resolve();
  },
};
