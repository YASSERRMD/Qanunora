import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { WorkspaceService } from './workspace.service';
import {
  CreateSavedViewDto,
  UpdateSavedViewDto,
  CreateQuickActionDto,
  ReorderQuickActionsDto,
} from './dto/workspace.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Workspace')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly service: WorkspaceService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get personal dashboard data' })
  getMyDashboard(@CurrentUser() user: { id: string }) {
    return this.service.getMyDashboard(user.id);
  }

  @Get('views')
  @ApiOperation({ summary: 'Get saved views' })
  @ApiQuery({ name: 'entityType', required: false })
  getSavedViews(
    @CurrentUser() user: { id: string },
    @Query('entityType') entityType?: string,
  ) {
    return this.service.getSavedViews(user.id, entityType);
  }

  @Post('views')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a saved view' })
  createSavedView(
    @Body() dto: CreateSavedViewDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.createSavedView(user.id, dto);
  }

  @Patch('views/:id')
  @ApiOperation({ summary: 'Update a saved view' })
  updateSavedView(
    @Param('id') id: string,
    @Body() dto: UpdateSavedViewDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.updateSavedView(id, user.id, dto);
  }

  @Delete('views/:id')
  @ApiOperation({ summary: 'Delete a saved view' })
  deleteSavedView(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.deleteSavedView(id, user.id);
  }

  @Patch('views/:id/set-default')
  @ApiOperation({ summary: 'Set a view as default for its entity type' })
  setDefaultView(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.setDefaultView(id, user.id);
  }

  @Get('quick-actions')
  @ApiOperation({ summary: 'Get quick actions ordered by order field' })
  getQuickActions(@CurrentUser() user: { id: string }) {
    return this.service.getQuickActions(user.id);
  }

  @Post('quick-actions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create or update a quick action' })
  upsertQuickAction(
    @Body() dto: CreateQuickActionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.upsertQuickAction(user.id, dto);
  }

  @Delete('quick-actions/:id')
  @ApiOperation({ summary: 'Delete a quick action' })
  deleteQuickAction(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.deleteQuickAction(id, user.id);
  }

  @Post('quick-actions/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder quick actions' })
  reorderQuickActions(
    @Body() dto: ReorderQuickActionsDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.reorderQuickActions(user.id, dto);
  }
}
