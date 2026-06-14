import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ReportingService } from './reporting.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { ExcelGeneratorService } from './excel-generator.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

type ReportFormat = 'json' | 'text' | 'csv';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('reports')
export class ReportingController {
  constructor(
    private readonly reportingService: ReportingService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly excelGenerator: ExcelGeneratorService,
  ) {}

  private sendReport(
    res: Response,
    reportData: Record<string, unknown>,
    reportType: string,
    format: ReportFormat,
  ) {
    if (format === 'text') {
      const file = this.pdfGenerator.generateTextReport(reportData, reportType);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      res.send(file.buffer);
      return;
    }

    if (format === 'csv') {
      const file = this.excelGenerator.generateCsv(reportData, reportType);
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      res.send(file.buffer);
      return;
    }

    res.json(reportData);
  }

  @Get('lifecycle/:itemId')
  @ApiOperation({ summary: 'Generate legislative lifecycle report (VIEWER+)' })
  @ApiQuery({ name: 'format', enum: ['json', 'text', 'csv'], required: false })
  async lifecycleReport(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query('format') format: ReportFormat = 'json',
    @Res() res: Response,
  ) {
    const data = await this.reportingService.generateLifecycleReport(itemId);
    this.sendReport(res, data as unknown as Record<string, unknown>, 'LIFECYCLE', format);
  }

  @Get('consultation/:consultationId')
  @ApiOperation({ summary: 'Generate consultation feedback report' })
  @ApiQuery({ name: 'format', enum: ['json', 'text', 'csv'], required: false })
  async consultationReport(
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Query('format') format: ReportFormat = 'json',
    @Res() res: Response,
  ) {
    const data = await this.reportingService.generateConsultationReport(consultationId);
    this.sendReport(res, data as unknown as Record<string, unknown>, 'CONSULTATION', format);
  }

  @Get('impact/:itemId')
  @ApiOperation({ summary: 'Generate impact analysis report' })
  @ApiQuery({ name: 'format', enum: ['json', 'text', 'csv'], required: false })
  async impactReport(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query('format') format: ReportFormat = 'json',
    @Res() res: Response,
  ) {
    const data = await this.reportingService.generateImpactReport(itemId);
    this.sendReport(res, data as unknown as Record<string, unknown>, 'IMPACT', format);
  }

  @Get('amendments/:itemId')
  @ApiOperation({ summary: 'Generate amendment report' })
  @ApiQuery({ name: 'format', enum: ['json', 'text', 'csv'], required: false })
  async amendmentReport(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query('format') format: ReportFormat = 'json',
    @Res() res: Response,
  ) {
    const data = await this.reportingService.generateAmendmentReport(itemId);
    this.sendReport(res, data as unknown as Record<string, unknown>, 'AMENDMENT', format);
  }

  @Get('audit/:itemId')
  @ApiOperation({ summary: 'Generate audit report (AUDITOR+)' })
  @ApiQuery({ name: 'format', enum: ['json', 'text', 'csv'], required: false })
  @Roles(UserRole.AUDITOR, UserRole.LEGISLATIVE_ADMIN, UserRole.SUPER_ADMIN)
  async auditReport(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query('format') format: ReportFormat = 'json',
    @Res() res: Response,
  ) {
    const data = await this.reportingService.generateAuditReport(itemId);
    this.sendReport(res, data as unknown as Record<string, unknown>, 'AUDIT', format);
  }

  @Get('ministry/:ministryId')
  @ApiOperation({ summary: 'Generate ministry summary report (LEGISLATIVE_ADMIN+)' })
  @ApiQuery({ name: 'format', enum: ['json', 'text', 'csv'], required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @Roles(UserRole.LEGISLATIVE_ADMIN, UserRole.SUPER_ADMIN)
  async ministryReport(
    @Param('ministryId', ParseUUIDPipe) ministryId: string,
    @Query('format') format: ReportFormat = 'json',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Res() res: Response = undefined as unknown as Response,
  ) {
    const data = await this.reportingService.generateMinistryReport(
      ministryId,
      dateFrom,
      dateTo,
    );
    this.sendReport(res, data as unknown as Record<string, unknown>, 'MINISTRY', format);
  }
}
