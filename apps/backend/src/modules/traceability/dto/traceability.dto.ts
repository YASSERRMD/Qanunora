import { IsOptional, IsString } from 'class-validator';

export const LINK_TYPES = [
  'REQUIREMENT_TO_ARTICLE',
  'AMENDMENT_TO_DISCUSSION',
  'FEEDBACK_TO_CHANGE',
  'APPROVAL_TO_VERSION',
  'DECISION_TO_ITEM',
] as const;

export type LinkType = (typeof LINK_TYPES)[number];

export class CreateTraceLinkDto {
  @IsString()
  sourceType: string;

  @IsString()
  sourceId: string;

  @IsString()
  targetType: string;

  @IsString()
  targetId: string;

  @IsString()
  linkType: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class TraceLinkFiltersDto {
  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  targetType?: string;

  @IsOptional()
  @IsString()
  linkType?: string;
}
