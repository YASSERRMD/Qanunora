import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AmendmentStatus } from '@prisma/client';

export class CreateAmendmentDto {
  @ApiProperty({ example: 'Amendment to Article 5 - Data Retention Period' })
  @IsString()
  @MaxLength(500)
  title: string;

  @ApiProperty({ example: 'Proposed change to extend the data retention period from 3 to 5 years' })
  @IsString()
  description: string;

  @ApiProperty({ example: 'Alignment with international best practices' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({ example: 'Article 5' })
  @IsOptional()
  @IsString()
  articleReference?: string;

  @ApiPropertyOptional({ example: 'Section 2.1' })
  @IsOptional()
  @IsString()
  sectionReference?: string;

  @ApiPropertyOptional({ example: 'Increases compliance burden for smaller entities' })
  @IsOptional()
  @IsString()
  impactSummary?: string;
}

export class UpdateAmendmentDto extends PartialType(CreateAmendmentDto) {}

export class AmendmentQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ enum: AmendmentStatus })
  @IsOptional()
  @IsEnum(AmendmentStatus)
  status?: AmendmentStatus;
}
