import {
  IsString,
  IsOptional,
  IsArray,
  IsDateString,
  IsEnum,
  MaxLength,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { LegislativeStatus, LegislativeItemType, ConfidentialityLevel, Priority } from '@prisma/client';

export class SearchWithFacetsDto {
  @ApiPropertyOptional({ description: 'Full-text search query' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  query?: string;

  @ApiPropertyOptional({ type: [String], enum: LegislativeStatus })
  @IsOptional()
  @IsArray()
  status?: LegislativeStatus[];

  @ApiPropertyOptional({ type: [String], enum: LegislativeItemType })
  @IsOptional()
  @IsArray()
  type?: LegislativeItemType[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  ministryId?: string[];

  @ApiPropertyOptional({ type: [String], enum: ConfidentialityLevel })
  @IsOptional()
  @IsArray()
  confidentialityLevel?: ConfidentialityLevel[];

  @ApiPropertyOptional({ type: [String], enum: Priority })
  @IsOptional()
  @IsArray()
  priority?: Priority[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SaveSearchDto {
  @ApiProperty({ description: 'Name for this saved search' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ description: 'Search query text' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ description: 'Active filters as JSON' })
  @IsOptional()
  filters?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['keyword', 'semantic', 'hybrid'] })
  @IsOptional()
  @IsString()
  searchType?: string;
}
