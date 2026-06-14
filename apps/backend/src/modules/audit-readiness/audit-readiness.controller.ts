import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditEvidenceService } from './audit-evidence.service';

@Controller('legislative-items')
export class AuditReadinessController {
  constructor(private readonly auditService: AuditEvidenceService) {}

  @Get(':id/audit-checklist')
  @Roles('AUDITOR', 'REVIEWER', 'MINISTRY_LEGAL_OFFICER', 'DRAFTING_OFFICER', 'LEGISLATIVE_ADMIN', 'SUPER_ADMIN')
  getChecklist(@Param('id') id: string) {
    return this.auditService.evaluateChecklist(id);
  }

  @Get(':id/audit-summary')
  @Roles('AUDITOR', 'REVIEWER', 'MINISTRY_LEGAL_OFFICER', 'DRAFTING_OFFICER', 'LEGISLATIVE_ADMIN', 'SUPER_ADMIN')
  getAuditSummary(@Param('id') id: string) {
    return this.auditService.getAuditSummary(id);
  }

  @Get(':id/audit-report')
  @Roles('AUDITOR', 'REVIEWER', 'LEGISLATIVE_ADMIN', 'SUPER_ADMIN')
  getAuditReport(@Param('id') id: string) {
    return this.auditService.exportAuditReport(id);
  }
}
