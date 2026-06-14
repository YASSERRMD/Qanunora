import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateCommitteeDto {
  @ApiProperty({ example: 'Legislative Review Committee' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'لجنة المراجعة التشريعية' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameAr?: string;

  @ApiPropertyOptional({ example: 'Reviews draft legislation before formal submission' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCommitteeDto extends PartialType(CreateCommitteeDto) {}

export class AddMemberDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ example: 'CHAIR', default: 'MEMBER' })
  @IsOptional()
  @IsString()
  role?: string;
}

export class CreateReviewDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  legislativeItemId: string;

  @ApiPropertyOptional({ example: 'APPROVE' })
  @IsOptional()
  @IsString()
  recommendation?: string;

  @ApiPropertyOptional({ example: 'The draft is technically sound and ready for next stage.' })
  @IsOptional()
  @IsString()
  notes?: string;
}
