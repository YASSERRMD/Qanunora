import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsNumber,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateSavedViewDto {
  @ApiProperty({ description: 'View name' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ description: 'Entity type e.g. legislative_items' })
  @IsString()
  @MaxLength(100)
  entityType: string;

  @ApiPropertyOptional({ description: 'Active filters as JSON' })
  @IsOptional()
  filters?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Column config as JSON array' })
  @IsOptional()
  @IsArray()
  columnConfig?: string[];

  @ApiPropertyOptional({ description: 'Sort field' })
  @IsOptional()
  @IsString()
  sortField?: string;

  @ApiPropertyOptional({ description: 'Sort order: asc or desc' })
  @IsOptional()
  @IsString()
  sortOrder?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateSavedViewDto extends PartialType(CreateSavedViewDto) {}

export class CreateQuickActionDto {
  @ApiProperty({ description: 'Display label' })
  @IsString()
  @MaxLength(100)
  label: string;

  @ApiProperty({ description: 'Action type: navigate | create | run_search' })
  @IsString()
  actionType: string;

  @ApiPropertyOptional({ description: 'Action data as JSON' })
  @IsOptional()
  actionData?: Record<string, unknown>;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;
}

export class ReorderQuickActionsDto {
  @ApiProperty({ type: [String], description: 'Ordered array of quick action IDs' })
  @IsArray()
  orderedIds: string[];
}
