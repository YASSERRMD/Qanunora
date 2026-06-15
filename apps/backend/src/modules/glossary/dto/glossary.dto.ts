import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  MaxLength,
  MinLength,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TermStatus } from '@prisma/client';

export class CreateGlossaryTermDto {
  @ApiProperty({ description: 'English term' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  termEn: string;

  @ApiPropertyOptional({ description: 'Arabic term' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  termAr?: string;

  @ApiProperty({ description: 'English definition' })
  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  definition: string;

  @ApiPropertyOptional({ description: 'Arabic definition' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  definitionAr?: string;

  @ApiPropertyOptional({ default: 'general' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  domain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({ enum: TermStatus })
  @IsOptional()
  @IsEnum(TermStatus)
  status?: TermStatus;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPreferred?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  relatedTermIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;
}

export class UpdateGlossaryTermDto extends PartialType(CreateGlossaryTermDto) {}

export class GlossaryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  limit?: number;
}

export class SuggestTermsDto {
  @ApiProperty({ description: 'Legal text to analyse for term suggestions' })
  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  text: string;

  @ApiPropertyOptional({ default: 'legal' })
  @IsOptional()
  @IsString()
  domain?: string;
}

export class ImportTermsDto {
  @ApiProperty({ type: [CreateGlossaryTermDto] })
  @IsArray()
  terms: CreateGlossaryTermDto[];
}
