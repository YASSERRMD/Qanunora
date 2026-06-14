import { IsEnum, IsOptional, IsString, IsUUID, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentCategory } from '@prisma/client';

export class UploadDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  legislativeItemId?: string;

  @ApiPropertyOptional({ enum: DocumentCategory })
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class DocumentQueryDto {
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
  @IsUUID()
  legislativeItemId?: string;

  @ApiPropertyOptional({ enum: DocumentCategory })
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;
}
