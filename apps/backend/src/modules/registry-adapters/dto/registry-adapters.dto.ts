import { IsString, IsOptional, IsEnum, IsBoolean, IsUrl } from 'class-validator';

export enum RegistryType {
  ENTITY_REGISTRY = 'ENTITY_REGISTRY',
  MINISTRY_REGISTRY = 'MINISTRY_REGISTRY',
  GAZETTE_REGISTRY = 'GAZETTE_REGISTRY',
  LEGAL_REFERENCE_REGISTRY = 'LEGAL_REFERENCE_REGISTRY',
  PERSONNEL_REGISTRY = 'PERSONNEL_REGISTRY',
}

export class CreateAdapterDto {
  @IsString()
  name: string;

  @IsEnum(RegistryType)
  registryType: RegistryType;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  config?: Record<string, unknown>;
}

export class UpdateAdapterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  config?: Record<string, unknown>;
}
