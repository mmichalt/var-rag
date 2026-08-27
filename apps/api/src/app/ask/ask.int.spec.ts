/**
 * Requires PostgreSQL. Skipped unless DATABASE_URL is set.
 * Uses hash embeddings and a fake generator — no Ollama.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { loadBackendConfig } from '@var-rag/config';
import { PrismaService } from '@var-rag/database';
import {
  FakeAnswerGenerator,
  HashEmbedder,
  buildChunkSet,
  ingestAndPublish,
} from '@var-rag/rag';
import request from 'supertest';
import { configureHttpApp } from '../../http';
import { AppModule } from '../app.module';
import { ANSWER_GENERATOR, EMBEDDER } from '../tokens';

const enabled = Boolean(
  process.env.CI && process.env.DATABASE_URL && process.env.REDIS_URL,
);

const embedder = new HashEmbedder('nomic-embed-text', 768);
const generator = new FakeAnswerGenerator('llama3.2:3b');

const describeSlice = enabled ? describe : describe.skip;

describeSlice('Ask the Laws slice', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let documentId = '';
  let chunkId = '';
  let activeChunkSetId: string | null = null;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMBEDDER)
      .useValue(embedder)
      .overrideProvider(ANSWER_GENERATOR)
      .useValue(generator)
      .compile();

    const config = loadBackendConfig();
    app = moduleRef.createNestApplication();
    configureHttpApp(app, { ...config, swaggerEnabled: false });
    await app.init();
    prisma = app.get(PrismaService);

    const pdfPath = [
      resolve(process.cwd(), 'data/synthetic-lawbook-2025-26.pdf'),
      resolve(process.cwd(), '../../data/synthetic-lawbook-2025-26.pdf'),
    ].find((path) => existsSync(path));
    if (!pdfPath) {
      throw new Error('synthetic-lawbook-2025-26.pdf not found');
    }
    const bytes = await readFile(pdfPath);
    const result = await ingestAndPublish(prisma, {
      ingest: {
        familyName: 'synthetic-lawbook',
        bytes,
        canonicalUrl: 'https://example.invalid/lawbook/2025-26',
        title: 'Synthetic Lawbook 2025/26',
        edition: '2025/26',
        effectiveFrom: new Date('2025-07-01T00:00:00.000Z'),
        effectiveTo: new Date('2026-06-30T23:59:59.999Z'),
      },
      embedder,
      config,
    });
    documentId = result.published.document.id;
    activeChunkSetId = result.published.document.activeChunkSetId;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('answers a law question with citations, an answer log, and capped evidence', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ask')
      .send({
        query: 'When is a player penalised for handball?',
        mode: 'laws',
        edition: '2025/26',
      })
      .set('x-request-id', 'slice-test-handball-1');

    expect(response.status).toBe(200);
    expect(response.body.kind).toBe('answer');
    const units = response.body.answer.answerUnits as Array<{
      citations: string[];
      type: string;
      text: string;
    }>;
    expect(units.length).toBeGreaterThan(0);
    for (const unit of units) {
      expect(unit.citations.length).toBeGreaterThan(0);
      for (const citation of unit.citations) {
        const index = Number.parseInt(citation.slice(1), 10);
        expect(response.body.answer.evidence[index - 1]).toBeDefined();
      }
    }
    expect(response.body.answer.resolvedEdition).toBe('2025/26');
    chunkId = response.body.answer.evidence[0].id;

    const log = await prisma.answerLog.findFirst({
      where: { requestId: 'slice-test-handball-1' },
    });
    expect(log).toBeTruthy();
    expect(log?.promptVersion).toBeTruthy();
    expect(log?.policyVersion).toBeTruthy();
    expect(log?.retrievalVersion).toBeTruthy();
    expect(log?.chunkingVersion).toBeTruthy();
    expect(log?.embeddingDigest).toBe(embedder.digest);
    expect(log?.outcome).toBe('ANSWER');

    const evidence = await request(app.getHttpServer()).get(
      `/api/v1/evidence/${chunkId}`,
    );
    expect(evidence.status).toBe(200);
    expect(evidence.body.excerpt.length).toBeLessThanOrEqual(400);
    expect(evidence.body.locator.lawNumber).toBeTruthy();
    expect(evidence.body.canonicalUrl).toBeTruthy();
    expect(documentId).toBeTruthy();
  });

  it('abstains when retrieved chunks are below the relevance cutoff', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ask')
      .send({
        query: 'How many tablespoons of baking powder go in a chocolate cake?',
        mode: 'laws',
        edition: '2025/26',
      });
    expect(response.status).toBe(200);
    expect(response.body.kind).toBe('insufficient_evidence');
  });

  it('reuses a matching chunk set on an identical rebuild', async () => {
    const first = await buildChunkSet(prisma, { documentId, embedder });
    const second = await buildChunkSet(prisma, { documentId, embedder });
    expect(second.id).toBe(first.id);
    expect(['READY', 'ACTIVE']).toContain(second.status);
  });

  it('hides chunks when the source family is inactive', async () => {
    const document = await prisma.sourceDocument.findUniqueOrThrow({
      where: { id: documentId },
    });
    await prisma.sourceFamily.update({
      where: { id: document.familyId },
      data: { usageStatus: 'INACTIVE' },
    });
    try {
      const response = await request(app.getHttpServer())
        .post('/api/v1/ask')
        .send({
          query: 'When is a player penalised for handball?',
          mode: 'laws',
          edition: '2025/26',
        });
      expect(response.body.kind).toBe('clarification');
      expect(response.body.clarification.reason).toBe('ambiguous_edition');
      const evidence = await request(app.getHttpServer()).get(
        `/api/v1/evidence/${chunkId}`,
      );
      expect(evidence.status).toBe(410);
    } finally {
      await prisma.sourceFamily.update({
        where: { id: document.familyId },
        data: { usageStatus: 'ACTIVE' },
      });
    }
  });

  it('returns 410 without text for a retired document chunk', async () => {
    await prisma.sourceDocument.update({
      where: { id: documentId },
      data: { status: 'RETIRED', activeChunkSetId: null },
    });
    const evidence = await request(app.getHttpServer()).get(
      `/api/v1/evidence/${chunkId}`,
    );
    expect(evidence.status).toBe(410);
    expect(evidence.body.retired).toBe(true);
    expect(evidence.body.excerpt).toBeUndefined();
    await prisma.sourceDocument.update({
      where: { id: documentId },
      data: {
        status: 'PUBLISHED',
        activeChunkSetId,
      },
    });
  });
});
