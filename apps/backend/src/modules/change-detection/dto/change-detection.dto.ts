import { IsOptional, IsString, IsUUID } from 'class-validator';

export class DetectChangesDto {
  @IsUUID()
  versionId1: string;

  @IsUUID()
  versionId2: string;

  @IsOptional()
  @IsString()
  provider?: string;
}
