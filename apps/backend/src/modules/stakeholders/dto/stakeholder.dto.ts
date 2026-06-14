import {
  IsString,
  IsEnum,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { StakeholderType } from '@prisma/client';

export class CreateStakeholderDto {
  @ApiProperty({ example: 'Qatar Chamber of Commerce' })
  @IsString()
  @MaxLength(500)
  name: string;

  @ApiPropertyOptional({ example: 'غرفة تجارة قطر' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nameAr?: string;

  @ApiProperty({ enum: StakeholderType })
  @IsEnum(StakeholderType)
  type: StakeholderType;

  @ApiPropertyOptional({ example: 'contact@qatarchamber.com' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+974 4455 6677' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'West Bay, Doha, Qatar' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'https://www.qatarchamber.com' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: 'Primary chamber representing business interests in Qatar' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateStakeholderDto extends PartialType(CreateStakeholderDto) {}

export class StakeholderQueryDto {
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

  @ApiPropertyOptional({ enum: StakeholderType })
  @IsOptional()
  @IsEnum(StakeholderType)
  type?: StakeholderType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class LogCommunicationDto {
  @ApiProperty({ example: 'Invitation to participate in Consumer Protection Consultation' })
  @IsString()
  @MaxLength(500)
  subject: string;

  @ApiProperty({ example: 'Dear Qatar Chamber, we invite you to participate...' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ example: 'EMAIL', default: 'EMAIL' })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional({ example: 'OUTBOUND', default: 'OUTBOUND' })
  @IsOptional()
  @IsString()
  direction?: string;
}
