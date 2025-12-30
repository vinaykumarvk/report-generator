import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL must be a valid URL')
    .optional(),
  DIRECT_DATABASE_URL: z
    .string()
    .url('DIRECT_DATABASE_URL must be a valid URL')
    .optional(),
  REDIS_URL: z
    .string()
    .url('REDIS_URL must be a valid URL')
    .optional(),
  S3_ENDPOINT: z.string().url('S3_ENDPOINT must be a valid URL').optional(),
  S3_ACCESS_KEY: z.string().min(1).optional(),
  S3_SECRET_KEY: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  FEATURE_FLAGS: z.string().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().default('Report Generator')
});

export type AppConfig = ReturnType<typeof parseConfig>;

let cachedConfig: AppConfig | null = null;

function parseFeatureFlags(rawFlags?: string) {
  if (!rawFlags) return {} as Record<string, boolean>;

  return rawFlags.split(',').reduce<Record<string, boolean>>((acc, entry) => {
    const [key, rawValue] = entry.split('=').map((value) => value.trim());
    if (!key) return acc;

    const normalizedValue = rawValue?.toLowerCase();
    acc[key] = normalizedValue === 'true' || normalizedValue === '1' || normalizedValue === 'on';
    return acc;
  }, {});
}

function parseConfig() {
  const parsed = configSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(`Invalid configuration: ${parsed.error.toString()}`);
  }

  const data = parsed.data;

  const featureFlags = parseFeatureFlags(data.FEATURE_FLAGS);

  return {
    nodeEnv: data.NODE_ENV,
    databaseUrl: data.DATABASE_URL,
    directDatabaseUrl: data.DIRECT_DATABASE_URL || data.DATABASE_URL,
    redisUrl: data.REDIS_URL,
    logLevel: data.LOG_LEVEL,
    s3:
      data.S3_ENDPOINT && data.S3_ACCESS_KEY && data.S3_SECRET_KEY && data.S3_BUCKET
        ? {
            endpoint: data.S3_ENDPOINT,
            accessKey: data.S3_ACCESS_KEY,
            secretKey: data.S3_SECRET_KEY,
            bucket: data.S3_BUCKET,
          }
        : undefined,
    featureFlags,
    appName: data.NEXT_PUBLIC_APP_NAME
  } as const;
}

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = parseConfig();
  }

  return cachedConfig;
}
