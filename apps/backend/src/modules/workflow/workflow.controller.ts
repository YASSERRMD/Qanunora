import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { WorkflowAction } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { WorkflowService } from './workflow.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

class TransitionDto {
  @ApiProperty({ enum: WorkflowAction })
  @IsEnum(WorkflowAction)
  action: WorkflowAction;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

class AddCommentDto {
  @ApiProperty()
  @IsString()
  comment: string;
}

@ApiTags('Workflow')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('legislative-items/:id')
export class WorkflowController {
  constructor(private readonly service: WorkflowService) {}

  @Post('transition')
  @ApiOperation({ summary: 'Perform a workflow transition on a legislative item' })
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.service.transition(id, dto.action, user.id, user.role, dto.comment);
  }

  @Get('workflow-history')
  @ApiOperation({ summary: 'Get workflow history for a legislative item' })
  getHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getHistory(id);
  }

  @Post('workflow-comment')
  @ApiOperation({ summary: 'Add a comment to the workflow history' })
  addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.service.addComment(id, user.id, user.role, dto.comment);
  }

  @Get('available-actions')
  @ApiOperation({ summary: 'Get available workflow actions for the current user role' })
  getAvailableActions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { role: UserRole },
  ) {
    return this.service.getAvailableActions(id, user.role);
  }
}
