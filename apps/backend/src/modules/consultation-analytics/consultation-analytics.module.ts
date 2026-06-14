import { Module } from '@nestjs/common';
import { ConsultationAnalyticsService } from './consultation-analytics.service';
import { ConsultationAnalyticsController } from './consultation-analytics.controller';

@Module({
  controllers: [ConsultationAnalyticsController],
  providers: [ConsultationAnalyticsService],
  exports: [ConsultationAnalyticsService],
})
export class ConsultationAnalyticsModule {}
