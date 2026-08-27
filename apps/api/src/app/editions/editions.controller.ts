import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@var-rag/database';
import { listLawEditions } from '@var-rag/rag';

@ApiTags('law-editions')
@Controller('law-editions')
export class LawEditionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Published law editions with effective dates' })
  list() {
    return listLawEditions(this.prisma);
  }
}
