import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class AskDto {
  @ApiProperty({ example: 'When is a player penalised for handball?' })
  @IsString()
  @MinLength(3)
  query!: string;

  @ApiProperty({ enum: ['laws'] })
  @Equals('laws')
  mode!: 'laws';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  edition?: string;

  @ApiPropertyOptional({ example: '2025-08-01' })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;

  @ApiPropertyOptional({ example: '2025/26' })
  @IsOptional()
  @IsString()
  season?: string;
}
