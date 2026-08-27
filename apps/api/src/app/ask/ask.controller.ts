import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { AskDto } from './ask.dto';
import { AskService } from './ask.service';

class AnswerResponse {
  kind!: 'answer';
}

class ClarificationResponse {
  kind!: 'clarification';
}

class InsufficientEvidenceResponse {
  kind!: 'insufficient_evidence';
}

@ApiTags('ask')
@ApiExtraModels(
  AnswerResponse,
  ClarificationResponse,
  InsufficientEvidenceResponse,
)
@UseGuards(ThrottlerGuard)
@Controller('ask')
export class AskController {
  constructor(private readonly askService: AskService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Ask a football law question' })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(AnswerResponse) },
        { $ref: getSchemaPath(ClarificationResponse) },
        { $ref: getSchemaPath(InsufficientEvidenceResponse) },
      ],
      discriminator: { propertyName: 'kind' },
    },
  })
  ask(@Body() dto: AskDto, @Req() req: Request) {
    const requestId = String(req.headers['x-request-id'] ?? '');
    return this.askService.ask(dto, requestId);
  }
}
