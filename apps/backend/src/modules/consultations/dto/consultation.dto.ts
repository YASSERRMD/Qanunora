import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateConsultationDto {
  @ApiProperty({ example: 'Public Consultation on Consumer Protection Bill' })
  @IsString()
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional({ example: 'We invite all stakeholders to provide feedback on this draft bill.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  legislativeItemId: string;

  @ApiPropertyOptional({ example: '2025-09-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  openDate?: string;

  @ApiPropertyOptional({ example: '2025-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  closeDate?: string;
}

export class UpdateConsultationDto extends PartialType(CreateConsultationDto) {}

export class SubmitFeedbackDto {
  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsOptional()
  @IsUUID()
  stakeholderId?: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  submitterName?: string;

  @ApiPropertyOptional({ example: 'jane@example.com' })
  @IsOptional()
  @IsString()
  submitterEmail?: string;

  @ApiProperty({ example: 'The data retention clause should be extended to 7 years...' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ example: 'DATA_PROTECTION' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'POSITIVE' })
  @IsOptional()
  @IsString()
  sentiment?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class ReviewFeedbackDto {
  @ApiProperty({ example: 'ACCEPTED' })
  @IsString()
  decision: string;

  @ApiPropertyOptional({ example: 'Feedback raises a valid point and will be incorporated.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class FeedbackQueryDto {
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
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sentiment?: string;
}
