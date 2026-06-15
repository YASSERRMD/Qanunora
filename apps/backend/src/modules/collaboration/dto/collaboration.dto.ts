import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AcquireLockDto {
  @ApiPropertyOptional({ description: 'Optional session ID for tracking' })
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class AutosaveDto {
  @ApiProperty({ description: 'Current document content' })
  @IsString()
  content: string;
}
