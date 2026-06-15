import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString, IsUUID, IsInt, Min } from 'class-validator';

export class AddReadingStageDto {
  @ApiProperty()
  @IsUUID()
  legislativeItemId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  stageNumber: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  stageName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;
}
