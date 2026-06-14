import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  MaxLength,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { LegalStructureType } from '@prisma/client';

export class CreateLegalStructureDto {
  @ApiProperty({ enum: LegalStructureType })
  @IsEnum(LegalStructureType)
  type: LegalStructureType;

  @ApiProperty({ example: '1' })
  @IsString()
  @MaxLength(50)
  number: string;

  @ApiPropertyOptional({ example: 'General Provisions' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ example: 'This chapter sets out the general provisions...' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  order: number;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateLegalStructureDto extends PartialType(CreateLegalStructureDto) {}

export class ReorderItemDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  id: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  order: number;
}

export class ReorderLegalStructureDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
