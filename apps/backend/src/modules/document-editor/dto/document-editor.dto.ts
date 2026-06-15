import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EditType } from '@prisma/client';

export class SaveEditDto {
  @ApiProperty({ description: 'Full document content snapshot' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Description of the change' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeDescription?: string;

  @ApiPropertyOptional({ enum: EditType })
  @IsOptional()
  @IsEnum(EditType)
  editType?: EditType;
}

export class AddCommentDto {
  @ApiProperty({ description: 'Comment content' })
  @IsString()
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({ description: 'Reference to article/clause e.g. "Article 3, Clause 2"' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  articleRef?: string;
}

export class GetCommentsQueryDto {
  @ApiPropertyOptional({ description: 'Include resolved comments' })
  @IsOptional()
  @IsBoolean()
  includeResolved?: boolean;
}
