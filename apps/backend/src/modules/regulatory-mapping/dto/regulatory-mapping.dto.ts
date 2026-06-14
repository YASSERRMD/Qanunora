import { IsArray, IsBoolean, IsOptional, IsString, ArrayMinSize } from 'class-validator';

export class DetectRegulationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  existingLaws: string[];

  @IsOptional()
  @IsString()
  provider?: string;
}

export class CreateReferenceDto {
  @IsString()
  referenceType: string;

  @IsString()
  referenceName: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isConflicting?: boolean;
}
