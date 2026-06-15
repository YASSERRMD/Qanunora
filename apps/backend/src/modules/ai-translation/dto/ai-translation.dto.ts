import { IsString, IsOptional, IsEnum, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTranslationDto {
  @ApiProperty({ description: 'Text to translate' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  sourceText: string;

  @ApiPropertyOptional({ default: 'ar', description: 'Source language code' })
  @IsOptional()
  @IsString()
  sourceLang?: string;

  @ApiPropertyOptional({ default: 'en', description: 'Target language code' })
  @IsOptional()
  @IsString()
  targetLang?: string;

  @ApiPropertyOptional({ default: 'legal', description: 'Domain for legal context' })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({ description: 'Entity type this translation belongs to' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ description: 'Entity ID this translation belongs to' })
  @IsOptional()
  @IsString()
  entityId?: string;
}

export class ReviewTranslationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class TranslationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceLang?: string;

  @ApiPropertyOptional()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  limit?: number;
}
