import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ChangeDetectionService } from './change-detection.service';
import { DetectChangesDto } from './dto/change-detection.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Change Detection')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller()
export class ChangeDetectionController {
  constructor(private readonly service: ChangeDetectionService) {}

  /**
   * POST /versions/detect-changes
   * Run semantic diff between two versions.
   */
  @Post('versions/detect-changes')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
    UserRole.REVIEWER,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Detect semantic changes between two versions' })
  async detectChanges(
    @Body() body: DetectChangesDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.detectChanges(body.versionId1, body.versionId2, body.provider, user.id);
  }

  /**
   * POST /versions/detect-risk-changes
   * Run risk-focused change detection between two versions.
   */
  @Post('versions/detect-risk-changes')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
    UserRole.REVIEWER,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Detect risk-introducing changes between two versions' })
  async detectRiskChanges(
    @Body() body: DetectChangesDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.detectRiskChanges(
      body.versionId1,
      body.versionId2,
      body.provider,
      user.id,
    );
  }

  /**
   * GET /legislative-items/:id/change-history
   * Get all change detection analyses for a legislative item.
   */
  @Get('legislative-items/:id/change-history')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
    UserRole.REVIEWER,
    UserRole.COMMITTEE_MEMBER,
    UserRole.AUDITOR,
    UserRole.VIEWER,
  )
  @ApiOperation({ summary: 'Get change detection history for a legislative item' })
  async getChangeHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getChangeDetectionHistory(id);
  }
}
