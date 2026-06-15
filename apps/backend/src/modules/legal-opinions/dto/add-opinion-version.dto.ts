import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class AddOpinionVersionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;
}
