import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  LegislativeItemType,
  LegislativeStatus,
  ConfidentialityLevel,
  Priority,
} from '@prisma/client';

export class CreateLegislativeItemDto {
  @ApiProperty({ example: 'Draft Consumer Protection Law 2025' })
  @IsString()
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional({ example: 'مشروع قانون حماية المستهلك 2025' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  titleAr?: string;

  @ApiProperty({ enum: LegislativeItemType })
  @IsEnum(LegislativeItemType)
  type: LegislativeItemType;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  ministryId: string;

  @ApiPropertyOptional({ enum: ConfidentialityLevel })
  @IsOptional()
  @IsEnum(ConfidentialityLevel)
  confidentialityLevel?: ConfidentialityLevel;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional({ example: 'Legislation to protect consumer rights...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'To standardize consumer protection across sectors' })
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiPropertyOptional({ example: '2025-12-31T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  targetEnactmentDate?: string;
}

export class UpdateLegislativeItemDto extends PartialType(CreateLegislativeItemDto) {
  @ApiPropertyOptional({ enum: LegislativeStatus })
  @IsOptional()
  @IsEnum(LegislativeStatus)
  status?: LegislativeStatus;
}

export class LegislativeItemQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: LegislativeItemType })
  @IsOptional()
  @IsEnum(LegislativeItemType)
  type?: LegislativeItemType;

  @ApiPropertyOptional({ enum: LegislativeStatus })
  @IsOptional()
  @IsEnum(LegislativeStatus)
  status?: LegislativeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ministryId?: string;
}
