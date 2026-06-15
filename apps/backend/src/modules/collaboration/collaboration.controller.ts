import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CollaborationService } from './collaboration.service';
import { AcquireLockDto, AutosaveDto } from './dto/collaboration.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Collaboration')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('collaboration')
export class CollaborationController {
  constructor(private readonly service: CollaborationService) {}

  @Post('lock/:legislativeItemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acquire a 30-minute document lock' })
  acquireLock(
    @Param('legislativeItemId') legislativeItemId: string,
    @Body() dto: AcquireLockDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.acquireLock(legislativeItemId, user.id, dto);
  }

  @Delete('lock/:legislativeItemId')
  @ApiOperation({ summary: 'Release a document lock' })
  releaseLock(
    @Param('legislativeItemId') legislativeItemId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.releaseLock(legislativeItemId, user.id);
  }

  @Get('lock/:legislativeItemId')
  @ApiOperation({ summary: 'Check the current document lock' })
  checkLock(@Param('legislativeItemId') legislativeItemId: string) {
    return this.service.checkLock(legislativeItemId);
  }

  @Post('autosave/:legislativeItemId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Save an autosave snapshot' })
  autoSave(
    @Param('legislativeItemId') legislativeItemId: string,
    @Body() dto: AutosaveDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.autoSave(legislativeItemId, dto, user.id);
  }

  @Get('autosave/:legislativeItemId')
  @ApiOperation({ summary: 'Get autosave history (last 5 snapshots)' })
  getAutosaveHistory(@Param('legislativeItemId') legislativeItemId: string) {
    return this.service.getAutosaveHistory(legislativeItemId);
  }

  @Get('presence/:documentId')
  @ApiOperation({ summary: 'Get list of connected user IDs for a document' })
  getPresence(@Param('documentId') documentId: string) {
    return { documentId, activeUsers: this.service.getPresence(documentId) };
  }
}
