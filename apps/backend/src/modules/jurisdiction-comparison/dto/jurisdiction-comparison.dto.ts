import { IsOptional, IsString } from 'class-validator';

export class CompareJurisdictionDto {
  @IsString()
  targetJurisdiction: string;

  @IsOptional()
  @IsString()
  referenceContext?: string;

  @IsOptional()
  @IsString()
  provider?: string;
}
