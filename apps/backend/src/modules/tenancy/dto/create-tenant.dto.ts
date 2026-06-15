import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  Matches,
  IsObject,
} from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Ministry of Justice' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'ministry-of-justice', description: 'URL-safe slug, lowercase letters/numbers/hyphens' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must contain only lowercase letters, numbers, and hyphens' })
  slug: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
