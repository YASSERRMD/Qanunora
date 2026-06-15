import { IsString, IsOptional, IsBoolean, IsEnum, IsUrl, IsNumber } from 'class-validator';

export enum IntegrationAuthType {
  API_KEY = 'API_KEY',
  BEARER_TOKEN = 'BEARER_TOKEN',
  BASIC_AUTH = 'BASIC_AUTH',
  OAUTH2 = 'OAUTH2',
  NONE = 'NONE',
}

export class CreateIntegrationDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  baseUrl: string;

  @IsOptional()
  @IsEnum(IntegrationAuthType)
  authType?: IntegrationAuthType;

  @IsOptional()
  authConfig?: Record<string, unknown>;

  @IsOptional()
  headers?: Record<string, string>;
}

export class UpdateIntegrationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsEnum(IntegrationAuthType)
  authType?: IntegrationAuthType;

  @IsOptional()
  authConfig?: Record<string, unknown>;

  @IsOptional()
  headers?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateWebhookDto {
  @IsString()
  eventType: string;

  @IsString()
  targetUrl: string;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  maxRetries?: number;
}

export class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  targetUrl?: string;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  maxRetries?: number;
}
