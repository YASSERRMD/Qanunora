import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class AddDecisionLinkDto {
  @ApiProperty({ enum: ['legislative_item', 'amendment', 'document', 'meeting'] })
  @IsString()
  @IsIn(['legislative_item', 'amendment', 'document', 'meeting'])
  entityType: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  entityId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkNote?: string;
}
