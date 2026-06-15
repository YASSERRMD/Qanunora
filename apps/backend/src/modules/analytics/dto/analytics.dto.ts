import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class UpsertKpiDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  targetValue?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
