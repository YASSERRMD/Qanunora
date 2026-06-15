import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsUUID, IsOptional, IsString } from 'class-validator';
import { VotePosition } from '@prisma/client';

export class RecordMemberVoteDto {
  @ApiProperty()
  @IsUUID()
  memberId: string;

  @ApiProperty({ enum: VotePosition })
  @IsEnum(VotePosition)
  position: VotePosition;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
