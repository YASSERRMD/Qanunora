import { Module } from '@nestjs/common';
import { AuditEvidenceService } from './audit-evidence.service';
import { AuditReadinessController } from './audit-readiness.controller';

@Module({
  controllers: [AuditReadinessController],
  providers: [AuditEvidenceService],
  exports: [AuditEvidenceService],
})
export class AuditReadinessModule {}
