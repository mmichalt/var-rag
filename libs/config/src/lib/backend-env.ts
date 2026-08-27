import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const logLevels = ['debug', 'info', 'warn', 'error'] as const;
const nodeEnvs = ['development', 'test', 'production'] as const;

const envSchema = z.object({
  NODE_ENV: z.enum(nodeEnvs),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS is required'),
  LOG_LEVEL: z.enum(logLevels).default('info'),
  SWAGGER_ENABLED: z.enum(['true', 'false']).optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).optional(),
  OLLAMA_BASE_URL: z.string().min(1, 'OLLAMA_BASE_URL is required'),
  EMBEDDING_MODEL: z.string().min(1, 'EMBEDDING_MODEL is required'),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive(),
  LLM_MODEL: z.string().min(1, 'LLM_MODEL is required'),
  LLM_TEMPERATURE: z.coerce.number(),
  LLM_SEED: z.coerce.number().int(),
  LLM_NUM_CTX: z.coerce.number().int().positive(),
  SEMANTIC_CANDIDATE_K: z.coerce.number().int().positive(),
  LEXICAL_CANDIDATE_K: z.coerce.number().int().positive(),
  RETRIEVAL_TOP_K: z.coerce.number().int().positive(),
  ASK_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive(),
  DIAGNOSTICS_ENABLED: z.enum(['true', 'false']),
  QUERY_LOG_RETENTION_DAYS: z.coerce.number().int().positive(),
  FAKE_MODELS: z.enum(['true', 'false']).optional(),
});

export type BackendConfig = {
  nodeEnv: (typeof nodeEnvs)[number];
  apiPort: number;
  databaseUrl: string;
  redisUrl: string;
  corsOrigins: string[];
  logLevel: (typeof logLevels)[number];
  swaggerEnabled: boolean;
  ollamaBaseUrl: string;
  embeddingModel: string;
  embeddingDimensions: number;
  llmModel: string;
  llmTemperature: number;
  llmSeed: number;
  llmNumCtx: number;
  semanticCandidateK: number;
  lexicalCandidateK: number;
  retrievalTopK: number;
  askRateLimitPerMinute: number;
  diagnosticsEnabled: boolean;
  queryLogRetentionDays: number;
  fakeModels: boolean;
  s3?: {
    endpoint: string;
    region: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    forcePathStyle: boolean;
  };
};

export const BACKEND_CONFIG = Symbol('BACKEND_CONFIG');

function protocolOf(urlString: string, label: string): URL {
  try {
    return new URL(urlString);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
}

function assertPostgresUrl(urlString: string): void {
  const url = protocolOf(urlString, 'DATABASE_URL');
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use postgres:// or postgresql://');
  }
}

function assertRedisUrl(urlString: string): void {
  const url = protocolOf(urlString, 'REDIS_URL');
  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must use redis:// or rediss://');
  }
}

function assertOllamaUrl(urlString: string): void {
  const url = protocolOf(urlString, 'OLLAMA_BASE_URL');
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('OLLAMA_BASE_URL must use http:// or https://');
  }
}

export function redisConnectionOptions(redisUrl: string): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
} {
  const url = protocolOf(redisUrl, 'REDIS_URL');
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
}

export function parseBackendEnv(
  env: NodeJS.Dict<string> | NodeJS.ProcessEnv,
): BackendConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid backend configuration: ${details}`);
  }

  const raw = parsed.data;
  assertPostgresUrl(raw.DATABASE_URL);
  assertRedisUrl(raw.REDIS_URL);
  assertOllamaUrl(raw.OLLAMA_BASE_URL);

  if (raw.EMBEDDING_DIMENSIONS !== 768) {
    throw new Error(
      'EMBEDDING_DIMENSIONS must be 768 (Chunk.embedding column width)',
    );
  }

  const corsOrigins = raw.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must include at least one origin');
  }

  const swaggerEnabled =
    raw.SWAGGER_ENABLED === 'true'
      ? true
      : raw.SWAGGER_ENABLED === 'false'
        ? false
        : raw.NODE_ENV !== 'production';

  const s3 =
    raw.S3_ENDPOINT ||
    raw.S3_REGION ||
    raw.S3_ACCESS_KEY ||
    raw.S3_SECRET_KEY ||
    raw.S3_BUCKET
      ? {
          endpoint: raw.S3_ENDPOINT ?? '',
          region: raw.S3_REGION ?? 'us-east-1',
          accessKey: raw.S3_ACCESS_KEY ?? '',
          secretKey: raw.S3_SECRET_KEY ?? '',
          bucket: raw.S3_BUCKET ?? '',
          forcePathStyle: raw.S3_FORCE_PATH_STYLE !== 'false',
        }
      : undefined;

  return {
    nodeEnv: raw.NODE_ENV,
    apiPort: raw.API_PORT,
    databaseUrl: raw.DATABASE_URL,
    redisUrl: raw.REDIS_URL,
    corsOrigins,
    logLevel: raw.LOG_LEVEL,
    swaggerEnabled,
    ollamaBaseUrl: raw.OLLAMA_BASE_URL.replace(/\/+$/, ''),
    embeddingModel: raw.EMBEDDING_MODEL,
    embeddingDimensions: raw.EMBEDDING_DIMENSIONS,
    llmModel: raw.LLM_MODEL,
    llmTemperature: raw.LLM_TEMPERATURE,
    llmSeed: raw.LLM_SEED,
    llmNumCtx: raw.LLM_NUM_CTX,
    semanticCandidateK: raw.SEMANTIC_CANDIDATE_K,
    lexicalCandidateK: raw.LEXICAL_CANDIDATE_K,
    retrievalTopK: raw.RETRIEVAL_TOP_K,
    askRateLimitPerMinute: raw.ASK_RATE_LIMIT_PER_MINUTE,
    diagnosticsEnabled: raw.DIAGNOSTICS_ENABLED === 'true',
    queryLogRetentionDays: raw.QUERY_LOG_RETENTION_DAYS,
    fakeModels: raw.FAKE_MODELS === 'true',
    s3,
  };
}

function loadEnvFiles(): void {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      loadDotenv({ path, override: false });
    }
  }
}

export function loadBackendConfig(): BackendConfig {
  loadEnvFiles();
  return parseBackendEnv(process.env);
}
