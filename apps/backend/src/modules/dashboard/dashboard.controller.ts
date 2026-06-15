import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('pipeline')
  @ApiOperation({ summary: 'Pipeline KPIs — counts by legislative status' })
  getPipelineMetrics() {
    return this.dashboardService.getPipelineMetrics();
  }

  @Get('delayed')
  @ApiOperation({ summary: 'Items in INTERNAL_REVIEW or COMMITTEE_REVIEW for >14 days' })
  getDelayedItems() {
    return this.dashboardService.getDelayedItems();
  }

  @Get('bottlenecks')
  @ApiOperation({ summary: 'Average days per status transition (bottleneck analysis)' })
  getBottlenecks() {
    return this.dashboardService.getBottlenecks();
  }

  @Get('consultations')
  @ApiOperation({ summary: 'Open consultations, total feedback, avg feedback per consultation' })
  getConsultationMetrics() {
    return this.dashboardService.getConsultationMetrics();
  }

  @Get('approval-performance')
  @ApiOperation({ summary: 'Avg days from DRAFTING to APPROVED, broken down by ministry' })
  getApprovalPerformance() {
    return this.dashboardService.getApprovalPerformance();
  }

  @Get('activity')
  @ApiOperation({ summary: 'Last 10 workflow history entries with actor names' })
  getRecentActivity() {
    return this.dashboardService.getRecentActivity();
  }
}
