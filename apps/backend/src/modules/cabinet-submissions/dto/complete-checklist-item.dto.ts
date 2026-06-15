import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CompleteChecklistItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evidence?: string;
}
