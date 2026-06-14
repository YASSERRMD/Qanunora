import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Request,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { ConsultationAnalyticsService } from './consultation-analytics.service';

class ProviderDto {
  provider?: string;
}

@Controller('consultations')
export class ConsultationAnalyticsController {
  constructor(private readonly analyticsService: ConsultationAnalyticsService) {}

  @Post(':id/analytics/sentiment')
  @Roles('REVIEWER', 'MINISTRY_LEGAL_OFFICER', 'DRAFTING_OFFICER', 'LEGISLATIVE_ADMIN', 'SUPER_ADMIN')
  analyzeSentiment(
    @Param('id') id: string,
    @Body() dto: ProviderDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.analyticsService.analyzeSentiment(id, dto.provider, req.user.userId);
  }

  @Post(':id/analytics/topics')
  @Roles('REVIEWER', 'MINISTRY_LEGAL_OFFICER', 'DRAFTING_OFFICER', 'LEGISLATIVE_ADMIN', 'SUPER_ADMIN')
  clusterTopics(
    @Param('id') id: string,
    @Body() dto: ProviderDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.analyticsService.clusterTopics(id, dto.provider, req.user.userId);
  }

  @Get(':id/analytics')
  getAnalytics(@Param('id') id: string) {
    return this.analyticsService.getAnalytics(id);
  }

  @Get(':id/analytics/stakeholder-sentiment')
  getStakeholderSentiment(@Param('id') id: string) {
    return this.analyticsService.getStakeholderSentiment(id);
  }
}
