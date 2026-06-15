import { IsString, IsOptional, IsEmail, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitPublicFeedbackDto {
  @ApiProperty({ description: 'Name of the person submitting feedback' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  submittedByName: string;

  @ApiPropertyOptional({ description: 'Email address (optional)' })
  @IsOptional()
  @IsEmail()
  submittedByEmail?: string;

  @ApiProperty({ description: 'Feedback content' })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({ description: 'Category of feedback' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;
}

export class PublicItemQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  limit?: number;
}
