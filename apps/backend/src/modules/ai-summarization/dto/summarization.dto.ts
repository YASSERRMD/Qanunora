import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SummaryType } from '../summary-result.schema';

export class GenerateSummaryDto {
  @ApiProperty({
    enum: ['EXECUTIVE', 'CITIZEN', 'LEGAL_OFFICER', 'AMENDMENT', 'BILL'],
    description: 'The type of summary to generate',
  })
  @IsEnum(['EXECUTIVE', 'CITIZEN', 'LEGAL_OFFICER', 'AMENDMENT', 'BILL'])
  summaryType!: SummaryType;

  @ApiPropertyOptional({
    description:
      'AI provider to use (e.g. openai, anthropic, gemini). Omit to use the system default.',
  })
  @IsOptional()
  @IsString()
  provider?: string;
}
