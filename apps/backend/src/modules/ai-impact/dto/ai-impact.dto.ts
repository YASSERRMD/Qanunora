import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { ImpactCategory } from '@prisma/client';

export class AnalyzeImpactDto {
  @IsArray()
  @IsEnum(ImpactCategory, { each: true })
  categories: ImpactCategory[];

  @IsOptional()
  @IsString()
  provider?: string;
}
