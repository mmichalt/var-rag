import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { loadBackendConfig } from '@var-rag/config';
import { PrismaService } from '@var-rag/database';
import {
  HashEmbedder,
  OllamaAnswerGenerator,
  OllamaEmbedder,
  askLaws,
  buildChunkSet,
  ingestDocument,
  inspectDocument,
  publishDocument,
  rebuildPublishedChunkSets,
  retireDocument,
  retrieveHybrid,
  recallAtK,
  citationCoverage,
  abstentionRate,
  falseAbstentionRate,
  CHUNKING_VERSION,
  latestCorpusRevision,
  NORMALIZATION_VERSION,
  POLICY_VERSION,
  PROMPT_VERSION,
  RETRIEVAL_VERSION,
  resolveModelDigest,
  seasonRange,
  type EvalQuestion,
} from '@var-rag/rag';
import { WorkerModule } from './app/worker.module';

function datesForEdition(edition: string): {
  effectiveFrom: Date;
  effectiveTo: Date | null;
} {
  const range = seasonRange(edition);
  if (!range) {
    throw new Error(`Cannot infer effective dates from edition '${edition}'`);
  }
  return { effectiveFrom: range.from, effectiveTo: range.to };
}

async function embedder(fake: boolean) {
  const config = loadBackendConfig();
  if (fake) {
    return new HashEmbedder(config.embeddingModel, config.embeddingDimensions);
  }
  const instance = new OllamaEmbedder(
    config.ollamaBaseUrl,
    config.embeddingModel,
    config.embeddingDimensions,
  );
  instance.digest = await resolveModelDigest(
    config.ollamaBaseUrl,
    config.embeddingModel,
  );
  return instance;
}

export async function runCli(argv: string[]): Promise<void> {
  const command = argv[0];
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn'],
  });
  const db = app.get(PrismaService);
  const config = loadBackendConfig();

  try {
    if (command === 'ingest') {
      const { values } = parseArgs({
        args: argv.slice(1),
        options: {
          file: { type: 'string' },
          family: { type: 'string' },
          edition: { type: 'string' },
          url: { type: 'string' },
          title: { type: 'string' },
          'fake-embedder': { type: 'boolean', default: false },
        },
      });
      if (!values.file || !values.family || !values.edition || !values.url) {
        throw new Error('--file, --family, --edition and --url are required');
      }
      const bytes = await readFile(values.file);
      const dates = datesForEdition(values.edition);
      const ingested = await ingestDocument(db, {
        familyName: values.family,
        bytes,
        canonicalUrl: values.url,
        title: values.title ?? `Lawbook ${values.edition}`,
        edition: values.edition,
        effectiveFrom: dates.effectiveFrom,
        effectiveTo: dates.effectiveTo,
      });
      const built = await buildChunkSet(db, {
        documentId: ingested.document.id,
        embedder: await embedder(Boolean(values['fake-embedder'])),
        pages: ingested.pages,
      });
      console.log(
        JSON.stringify(
          {
            documentId: ingested.document.id,
            version: ingested.document.version,
            gatePassed: ingested.gatePassed,
            chunkSetId: built.id,
            chunkCount: built.chunkCount,
            report: ingested.report,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (command === 'inspect') {
      const { values } = parseArgs({
        args: argv.slice(1),
        options: { document: { type: 'string' } },
      });
      if (!values.document) {
        throw new Error('--document is required');
      }
      const report = await inspectDocument(db, values.document);
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    if (command === 'publish') {
      const { values } = parseArgs({
        args: argv.slice(1),
        options: {
          document: { type: 'string' },
          'force-extraction-gate': { type: 'boolean', default: false },
          'fake-embedder': { type: 'boolean', default: false },
        },
      });
      if (!values.document) {
        throw new Error('--document is required');
      }
      const active = await embedder(Boolean(values['fake-embedder']));
      const result = await publishDocument(db, {
        documentId: values.document,
        forceExtractionGate: Boolean(values['force-extraction-gate']),
        config,
        embeddingDigest: active.digest,
      });
      console.log(
        JSON.stringify(
          {
            documentId: result.document.id,
            status: result.document.status,
            chunkSetId: result.chunkSetId,
            revision: result.revision.revision,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (command === 'retire') {
      const { values } = parseArgs({
        args: argv.slice(1),
        options: {
          document: { type: 'string' },
          reason: { type: 'string' },
        },
      });
      if (!values.document || !values.reason) {
        throw new Error('--document and --reason are required');
      }
      const result = await retireDocument(db, {
        documentId: values.document,
        reason: values.reason,
      });
      console.log(
        JSON.stringify(
          {
            documentId: result.document.id,
            status: result.document.status,
            revision: result.revision.revision,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (command === 'eval') {
      const { readFile: read } = await import('node:fs/promises');
      const seed = JSON.parse(
        await read('docs/eval/laws-eval-seed-v1.json', 'utf8'),
      ) as { questions: EvalQuestion[] };
      const fake = argv.includes('--fake-embedder') || argv.includes('--fake');
      const active = await embedder(fake);
      const generator = fake
        ? null
        : new OllamaAnswerGenerator(config.ollamaBaseUrl, config.llmModel, {
            temperature: config.llmTemperature,
            seed: config.llmSeed,
            numCtx: config.llmNumCtx,
          });
      const retrieved: Record<
        string,
        Array<{ lawNumber: string | null; sourceText: string }>
      > = {};
      const answers: Record<
        string,
        {
          kind: 'answer' | 'clarification' | 'insufficient_evidence';
          cited: boolean;
        }
      > = {};
      for (const question of seed.questions) {
        const [queryEmbedding] = await active.embed([question.query]);
        const edition = question.edition ?? '2025/26';
        const result = await retrieveHybrid(db, {
          query: question.query,
          queryEmbedding,
          filters: {
            edition,
            embeddingModel: active.model,
            embeddingDigest: active.digest,
            embeddingDimensions: active.dimensions,
          },
          config,
        });
        retrieved[question.id] = result.chunks.map((chunk) => ({
          lawNumber: chunk.locator.lawNumber,
          sourceText: chunk.sourceText,
        }));
        if (!generator) {
          continue;
        }
        const asked = await askLaws(db, {
          request: {
            query: question.query,
            mode: 'laws',
            requestId: `eval-${question.id}`,
            edition,
          },
          config,
          embedder: active,
          generator,
        });
        const kind = asked.response.kind;
        const cited =
          kind === 'answer' &&
          asked.response.answer.answerUnits.every(
            (unit) => unit.citations.length > 0,
          );
        answers[question.id] = { kind, cited };
      }
      const corpus = await latestCorpusRevision(db);
      const generationMeasured = !fake;
      const metrics = {
        promptVersion: PROMPT_VERSION,
        policyVersion: POLICY_VERSION,
        retrievalVersion: RETRIEVAL_VERSION,
        chunkingVersion: CHUNKING_VERSION,
        normalizationVersion: NORMALIZATION_VERSION,
        corpusRevision: corpus.revision,
        corpusFingerprint: corpus.fingerprint,
        recallAt5: recallAtK(seed.questions, retrieved, 5),
        citationCoverage: generationMeasured
          ? citationCoverage(Object.values(answers))
          : null,
        abstentionRate: generationMeasured
          ? abstentionRate(seed.questions, answers)
          : null,
        falseAbstentionRate: generationMeasured
          ? falseAbstentionRate(seed.questions, answers)
          : null,
        generationMetrics: generationMeasured
          ? 'measured'
          : 'not_measured_with_fake_generator',
      };
      console.log(JSON.stringify(metrics, null, 2));
      return;
    }

    if (command === 'bench-ask') {
      const query = 'When is a player penalised for handball?';
      const active = await embedder(false);
      const generator = new OllamaAnswerGenerator(
        config.ollamaBaseUrl,
        config.llmModel,
        {
          temperature: config.llmTemperature,
          seed: config.llmSeed,
          numCtx: config.llmNumCtx,
        },
      );
      const result = await askLaws(db, {
        request: {
          query,
          mode: 'laws',
          requestId: 'bench-ask',
          edition: '2025/26',
        },
        config,
        embedder: active,
        generator,
      });
      console.log(
        JSON.stringify(
          { timings: result.timings, kind: result.response.kind },
          null,
          2,
        ),
      );
      return;
    }

    if (command === 'reindex') {
      const fake = argv.includes('--fake-embedder') || argv.includes('--fake');
      const result = await rebuildPublishedChunkSets(db, {
        embedder: await embedder(fake),
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    throw new Error(
      `Unknown command '${command}'. Use ingest, inspect, publish, retire, reindex, eval, bench-ask.`,
    );
  } finally {
    await app.close();
  }
}
