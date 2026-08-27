import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { loadBackendConfig, type BackendConfig } from '@var-rag/config';
import { PrismaService } from '@var-rag/database';
import {
  askLaws,
  type AnswerGenerator,
  type AskResponse,
  type Embedder,
} from '@var-rag/rag';
import { ANSWER_GENERATOR, EMBEDDER } from '../tokens';
import type { AskDto } from './ask.dto';

@Injectable()
export class AskService {
  private readonly config: BackendConfig = loadBackendConfig();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDER) private readonly embedder: Embedder,
    @Inject(ANSWER_GENERATOR) private readonly generator: AnswerGenerator,
  ) {}

  async ask(dto: AskDto, requestId: string): Promise<AskResponse> {
    const specified = [dto.edition, dto.asOfDate, dto.season].filter(Boolean);
    if (specified.length > 1) {
      throw new BadRequestException(
        'edition, asOfDate and season are mutually exclusive',
      );
    }
    const result = await askLaws(this.prisma, {
      request: {
        query: dto.query,
        mode: 'laws',
        requestId,
        edition: dto.edition,
        asOfDate: dto.asOfDate,
        season: dto.season,
      },
      config: this.config,
      embedder: this.embedder,
      generator: this.generator,
    });
    return result.response;
  }
}
