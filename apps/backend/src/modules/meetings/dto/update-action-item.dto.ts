import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsDateString, IsEnum } from 'class-validator';
import { ActionItemStatus } from '@prisma/client';

export class UpdateActionItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ enum: ActionItemStatus })
  @IsOptional()
  @IsEnum(ActionItemStatus)
  status?: ActionItemStatus;
}
