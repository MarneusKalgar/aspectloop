import { z } from 'zod';

const requestSchema = z
  .object({
    id: z.uuid(),
    password: z
      .string()
      .min(12)
      .max(72)
      .regex(/^[\x20-\x7e]+$/),
  })
  .strict();

/** Validates the bounded private pipe without including input in errors. */
export function parsePrivateFixtureInput(raw: string): { id: string; password: string } {
  try {
    if (Buffer.byteLength(raw, 'utf8') > 256) {
      throw new Error('Oversized input');
    }

    return requestSchema.parse(JSON.parse(raw) as unknown);
  } catch {
    // Deliberately omit parser/Zod causes, which can contain the private input.
    throw new Error('Invalid private fixture input');
  }
}

/** Reads one non-terminal, size/deadline-bounded private request; never echoes bytes. */
export async function readPrivateFixtureInput(): Promise<{ id: string; password: string }> {
  if (process.stdin.isTTY) {
    throw new Error('Private fixture mode requires a process pipe');
  }

  return new Promise(
    /** Keeps collection and failure cleanup private to this single bounded pipe. */
    (resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      const timer = setTimeout(onFailure, 10_000);

      /** Removes pipe listeners and transient password buffers on every settlement. */
      function dispose(): void {
        clearTimeout(timer);
        process.stdin.off('data', onData);
        process.stdin.off('end', onEnd);
        process.stdin.off('error', onFailure);
        process.stdin.pause();
        chunks.length = 0;
      }

      /** Rejects without echoing transport errors or partially collected input. */
      function onFailure(): void {
        dispose();
        reject(new Error('Private fixture pipe failed'));
      }

      /** Enforces the byte ceiling before retaining another private chunk. */
      function onData(chunk: Buffer): void {
        size += chunk.length;

        if (size > 256) {
          onFailure();
          return;
        }

        chunks.push(chunk);
      }

      /** Parses only a complete request and omits all credential-bearing causes. */
      function onEnd(): void {
        const raw = Buffer.concat(chunks).toString('utf8');
        dispose();

        try {
          resolve(parsePrivateFixtureInput(raw));
        } catch {
          reject(new Error('Invalid private fixture input'));
        }
      }

      process.stdin.on('data', onData);
      process.stdin.once('end', onEnd);
      process.stdin.once('error', onFailure);
      process.stdin.resume();
    },
  );
}
