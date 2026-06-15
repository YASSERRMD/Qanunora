import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { UpsertKpiDto } from './dto/analytics.dto';

@Controller('analytics')
@UseGuards(RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('snapshot')
  @Roles('SUPER_ADMIN', 'LEGISLATIVE_ADMIN', 'AUDITOR')
  getSnapshot() {
    return this.analyticsService.computeCurrentSnapshot();
  }

  @Post('snapshot/save')
  @Roles('SUPER_ADMIN')
  saveSnapshot() {
    return this.analyticsService.saveSnapshot();
  }

  @Get('trends')
  @Roles('SUPER_ADMIN', 'LEGISLATIVE_ADMIN', 'AUDITOR')
  getSnapshots(@Query('days') days?: string) {
    return this.analyticsService.getSnapshots(days ? parseInt(days) : 30);
  }

  @Get('trend/:metricPath')
  @Roles('SUPER_ADMIN', 'LEGISLATIVE_ADMIN', 'AUDITOR')
  getTrend(@Param('metricPath') metricPath: string, @Query('days') days?: string) {
    return this.analyticsService.getTrend(metricPath, days ? parseInt(days) : 30);
  }

  @Get('ministry-performance')
  @Roles('SUPER_ADMIN', 'LEGISLATIVE_ADMIN', 'AUDITOR')
  getMinistryPerformance() {
    return this.analyticsService.getMinistryPerformance();
  }

  @Get('throughput')
  @Roles('SUPER_ADMIN', 'LEGISLATIVE_ADMIN', 'AUDITOR')
  getLegislativeThroughput(@Query('year') year?: string) {
    return this.analyticsService.getLegislativeThroughput(year ? parseInt(year) : undefined);
  }

  @Get('kpis')
  @Roles('SUPER_ADMIN', 'LEGISLATIVE_ADMIN', 'AUDITOR')
  getKpiDashboard() {
    return this.analyticsService.getKpiDashboard();
  }

  @Put('kpis/:key')
  @Roles('SUPER_ADMIN')
  upsertKpi(@Param('key') key: string, @Body() dto: UpsertKpiDto) {
    return this.analyticsService.upsertKpiDefinition(key, dto);
  }

  @Get('export')
  @Roles('SUPER_ADMIN', 'AUDITOR')
  async exportForBi(@Query('format') format: 'json' | 'csv' = 'json', @Res() res: Response) {
    const data = await this.analyticsService.exportForBi(format);
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="qanunora-analytics.csv"');
      res.send(data as string);
    } else {
      res.json(data);
    }
  }
}
