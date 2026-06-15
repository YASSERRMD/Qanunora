import { IsString, IsOptional, IsEmail, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitAnonymousFeedbackDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  submitterName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  submitterEmail?: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;
}

export class ModeratorActionDto {
  @ApiPropertyOptional({ description: 'Optional moderator note' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
