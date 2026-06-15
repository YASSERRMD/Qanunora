import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RedlineType, RedlineStatus } from '@prisma/client';

export class ProposeRedlineDto {
  @ApiProperty({ description: 'Original text being replaced' })
  @IsString()
  originalText: string;

  @ApiProperty({ description: 'Proposed replacement text' })
  @IsString()
  proposedText: string;

  @ApiPropertyOptional({ enum: RedlineType })
  @IsOptional()
  @IsEnum(RedlineType)
  changeType?: RedlineType;

  @ApiPropertyOptional({ description: 'Reference to article/clause' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  articleRef?: string;

  @ApiPropertyOptional({ description: 'Rationale for the change' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rationale?: string;

  @ApiPropertyOptional({ type: [String], description: 'User IDs to mention' })
  @IsOptional()
  @IsArray()
  mentions?: string[];
}

export class ReviewRedlineDto {
  @ApiPropertyOptional({ description: 'Review note' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RedlineQueryDto {
  @ApiPropertyOptional({ enum: RedlineStatus })
  @IsOptional()
  @IsEnum(RedlineStatus)
  status?: RedlineStatus;
}
