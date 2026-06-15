import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { SessionType } from '@prisma/client';

export class CreateSessionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sessionNumber: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ enum: SessionType })
  @IsEnum(SessionType)
  sessionType: SessionType;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
