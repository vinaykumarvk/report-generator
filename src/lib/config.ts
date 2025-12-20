import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .default('postgresql://report_user:report_pass@localhost:5432/report_generator?schema=public'),
  DIRECT_DATABASE_URL: z
    .string()
    .optional()
    .default('postgresql://report_user:report_pass@localhost:5432/report_generator?schema=public'),
  REDIS_URL: z
    .string()
    .url('REDIS_URL must be a valid URL')
    .default('redis://localhost:6379'),
  S3_ENDPOINT: z.string().url('S3_ENDPOINT must be a valid URL').default('http://localhost:9000'),
  S3_ACCESS_KEY: z.string().min(1, 'S3_ACCESS_KEY is required').default('minio'),
  S3_SECRET_KEY: z.string().min(1, 'S3_SECRET_KEY is required').default('minio123'),
  S3_BUCKET: z.string().min(1, 'S3_BUCKET is required').default('report-generator'),
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

  const featureFlags = parseFeatureFlags(parsed.data.FEATURE_FLAGS);

  return {
    nodeEnv: parsed.data.NODE_ENV,
    databaseUrl: parsed.data.DATABASE_URL,
    directDatabaseUrl: parsed.data.DIRECT_DATABASE_URL,
    redisUrl: parsed.data.REDIS_URL,
    logLevel: parsed.data.LOG_LEVEL,
    s3: {
      endpoint: parsed.data.S3_ENDPOINT,
      accessKey: parsed.data.S3_ACCESS_KEY,
      secretKey: parsed.data.S3_SECRET_KEY,
      bucket: parsed.data.S3_BUCKET
    },
    featureFlags,
    appName: parsed.data.NEXT_PUBLIC_APP_NAME
  } as const;
}

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = parseConfig();
  }

  return cachedConfig;
}
