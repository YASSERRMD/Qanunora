import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DataRetentionService } from './data-retention.service';
import {
  CreateRetentionRuleDto,
  UpdateRetentionRuleDto,
  CreateLegalHoldDto,
  ArchiveItemDto,
} from './dto/data-retention.dto';

interface AuthRequest {
  user: { id: string };
}

@Controller('retention')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'AUDITOR')
export class DataRetentionController {
  constructor(private readonly retentionService: DataRetentionService) {}

  @Get('rules')
  getRules() {
    return this.retentionService.getRules();
  }

  @Post('rules')
  createRule(@Body() dto: CreateRetentionRuleDto, @Req() req: AuthRequest) {
    return this.retentionService.createRule(dto, req.user.id);
  }

  @Patch('rules/:id')
  updateRule(@Param('id') id: string, @Body() dto: UpdateRetentionRuleDto) {
    return this.retentionService.updateRule(id, dto);
  }

  @Post('rules/:id/run')
  runRule(@Param('id') id: string) {
    return this.retentionService.runRule(id);
  }

  @Get('holds')
  getLegalHolds(@Query('entityType') entityType?: string, @Query('entityId') entityId?: string) {
    return this.retentionService.getLegalHolds(entityType, entityId);
  }

  @Post('holds')
  createLegalHold(@Body() dto: CreateLegalHoldDto, @Req() req: AuthRequest) {
    return this.retentionService.createLegalHold(dto, req.user.id);
  }

  @Delete('holds/:id')
  releaseLegalHold(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.retentionService.releaseLegalHold(id, req.user.id);
  }

  @Get('archived')
  getArchivedItems(@Query('entityType') entityType?: string) {
    return this.retentionService.getArchivedItems(entityType);
  }

  @Post('archived')
  archiveItem(@Body() dto: ArchiveItemDto, @Req() req: AuthRequest) {
    return this.retentionService.archiveItem(dto, req.user.id);
  }

  @Post('archived/:id/restore')
  restoreItem(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.retentionService.restoreItem(id, req.user.id);
  }
}
