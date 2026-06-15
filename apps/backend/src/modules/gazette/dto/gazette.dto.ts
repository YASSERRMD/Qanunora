import { IsString, IsOptional, IsDateString } from 'class-validator';

export class UpdateGazetteDto {
  @IsOptional()
  @IsString()
  titleAr?: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  archiveUrl?: string;
}

export class RetractGazetteDto {
  @IsString()
  reason: string;
}
