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
import { AiSummarizationService } from './ai-summarization.service';
import { SummaryType } from './summary-result.schema';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class GenerateSummaryDto {
  summaryType!: SummaryType;
  provider?: string;
}

@ApiTags('AI Summarization')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller()
export class AiSummarizationController {
  constructor(private readonly service: AiSummarizationService) {}

  /**
   * POST /legislative-items/:itemId/summaries
   * Generate a new AI summary for a legislative item.
   */
  @Post('legislative-items/:itemId/summaries')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
    UserRole.REVIEWER,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate an AI summary for a legislative item' })
  async generateSummary(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: GenerateSummaryDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.summarizeLegislativeItem(
      itemId,
      body.summaryType,
      body.provider,
      user.id,
    );
  }

  /**
   * GET /legislative-items/:itemId/summaries
   * List all AI summaries for a legislative item.
   */
  @Get('legislative-items/:itemId/summaries')
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
  @ApiOperation({ summary: 'List all AI summaries for a legislative item' })
  async listSummaries(@Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.service.getSummaries(itemId);
  }

  /**
   * POST /ai-analyses/:id/regenerate
   * Regenerate an existing AI analysis using the same parameters.
   */
  @Post('ai-analyses/:id/regenerate')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
    UserRole.REVIEWER,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Regenerate an existing AI analysis' })
  async regenerateSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.regenerateSummary(id, user.id);
  }
}
