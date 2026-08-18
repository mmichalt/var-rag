import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@var-rag/database';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './tokens';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'Process liveness. Does not check dependencies.' })
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness. Requires PostgreSQL and Redis.' })
  async ready() {
    const details: Record<string, { status: 'up' | 'down' }> = {
      postgres: { status: 'down' },
      redis: { status: 'down' },
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      details.postgres = { status: 'up' };
    } catch {
      details.postgres = { status: 'down' };
    }

    try {
      const pong = await this.redis.ping();
      details.redis = { status: pong === 'PONG' ? 'up' : 'down' };
    } catch {
      details.redis = { status: 'down' };
    }

    if (details.postgres.status !== 'up' || details.redis.status !== 'up') {
      throw new ServiceUnavailableException({ status: 'error', details });
    }

    return { status: 'ok', details };
  }
}
