import { z } from 'zod';

function requiredEnvString(name: string) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value : ''),
    z
      .string()
      .trim()
      .min(1, { message: `${name} is required.` }),
  );
}

const envSchema = z.object({
  VITE_API_URL: requiredEnvString('VITE_API_URL').pipe(
    z.url({ message: 'VITE_API_URL must be a valid URL.' }),
  ),
  VITE_APP_NAME: requiredEnvString('VITE_APP_NAME'),
  VITE_MOCK_GQL_RUNTIME: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

const parsedEnv = envSchema.safeParse({
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME ?? 'Elemika Correction',
  VITE_MOCK_GQL_RUNTIME: import.meta.env.VITE_MOCK_GQL_RUNTIME ?? 'false',
});

if (!parsedEnv.success) {
  throw new Error(
    `Invalid web runtime environment: ${parsedEnv.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')}`,
  );
}

export const env = {
  apiUrl: parsedEnv.data.VITE_API_URL,
  appName: parsedEnv.data.VITE_APP_NAME,
  mockGraphqlRuntime: import.meta.env.DEV && parsedEnv.data.VITE_MOCK_GQL_RUNTIME,
};
