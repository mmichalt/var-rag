import {
  Controller,
  Get,
  GoneException,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@var-rag/database';
import { loadEvidence, type EvidenceRecord } from '@var-rag/rag';

@ApiTags('evidence')
@Controller('evidence')
export class EvidenceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':chunkId')
  @ApiOperation({
    summary: 'Provenance and a policy-limited excerpt for one chunk',
  })
  async get(@Param('chunkId') chunkId: string): Promise<EvidenceRecord> {
    const result = await loadEvidence(this.prisma, chunkId);
    if (result.status === 404) {
      throw new NotFoundException();
    }
    if (result.status === 410) {
      throw new GoneException({ retired: true });
    }
    return result.body;
  }
}
