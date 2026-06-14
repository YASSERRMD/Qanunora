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
import { AiImpactService } from './ai-impact.service';
import { AnalyzeImpactDto } from './dto/ai-impact.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('AI Impact Analysis')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller()
export class AiImpactController {
  constructor(private readonly service: AiImpactService) {}

  /**
   * POST /legislative-items/:id/impact-analysis
   * Run AI impact analysis for given categories.
   */
  @Post('legislative-items/:id/impact-analysis')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
    UserRole.REVIEWER,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate AI impact analysis for a legislative item' })
  async analyzeImpact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AnalyzeImpactDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.analyzeImpact(id, body.categories, body.provider, user.id);
  }

  /**
   * GET /legislative-items/:id/impact-analysis
   * List all impact analyses for an item.
   */
  @Get('legislative-items/:id/impact-analysis')
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
  @ApiOperation({ summary: 'List all impact analyses for a legislative item' })
  async getImpactAnalyses(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getImpactAnalyses(id);
  }

  /**
   * GET /legislative-items/:id/impact-analysis/summary
   * Get aggregated impact summary dashboard.
   */
  @Get('legislative-items/:id/impact-analysis/summary')
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
  @ApiOperation({ summary: 'Get aggregated impact summary for a legislative item' })
  async getImpactSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getImpactSummary(id);
  }
}
