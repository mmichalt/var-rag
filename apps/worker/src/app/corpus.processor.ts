import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { loadBackendConfig } from '@var-rag/config';
import { PrismaService } from '@var-rag/database';
import {
  HashEmbedder,
  OllamaEmbedder,
  buildChunkSet,
  activateChunkSet,
  pruneAnswerLogs,
  resolveModelDigest,
} from '@var-rag/rag';

export const CORPUS_QUEUE = 'corpus';

@Processor(CORPUS_QUEUE)
export class CorpusProcessor extends WorkerHost {
  private readonly logger = new Logger('corpus');
  private readonly config = loadBackendConfig();

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: {
    name: string;
    id?: string;
    data: Record<string, unknown>;
  }): Promise<unknown> {
    this.logger.log({ msg: 'corpus job', name: job.name, id: job.id });
    if (job.name === 'build-chunk-set') {
      const embedder = await this.resolveEmbedder(Boolean(job.data['fake']));
      return buildChunkSet(this.prisma, {
        documentId: String(job.data['documentId']),
        embedder,
      });
    }
    if (job.name === 'activate-chunk-set') {
      const embedder = await this.resolveEmbedder(Boolean(job.data['fake']));
      return activateChunkSet(this.prisma, {
        chunkSetId: String(job.data['chunkSetId']),
        config: this.config,
        embeddingDigest: embedder.digest,
      });
    }
    if (job.name === 'prune-answer-logs') {
      const deleted = await pruneAnswerLogs(
        this.prisma,
        this.config.queryLogRetentionDays,
      );
      return { deleted };
    }
    throw new Error(`Unknown corpus job ${job.name}`);
  }

  private async resolveEmbedder(fake: boolean) {
    if (fake) {
      return new HashEmbedder(
        this.config.embeddingModel,
        this.config.embeddingDimensions,
      );
    }
    const embedder = new OllamaEmbedder(
      this.config.ollamaBaseUrl,
      this.config.embeddingModel,
      this.config.embeddingDimensions,
    );
    embedder.digest = await resolveModelDigest(
      this.config.ollamaBaseUrl,
      this.config.embeddingModel,
    );
    return embedder;
  }
}
