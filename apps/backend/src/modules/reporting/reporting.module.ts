import { Module } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { ReportingController } from './reporting.controller';
import { PdfGeneratorService } from './pdf-generator.service';
import { ExcelGeneratorService } from './excel-generator.service';

@Module({
  controllers: [ReportingController],
  providers: [ReportingService, PdfGeneratorService, ExcelGeneratorService],
  exports: [ReportingService],
})
export class ReportingModule {}
