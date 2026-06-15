import { Module } from '@nestjs/common';
import { AuditChainService } from './audit-chain.service';
import { AdvancedAuditController } from './advanced-audit.controller';

@Module({
  controllers: [AdvancedAuditController],
  providers: [AuditChainService],
  exports: [AuditChainService],
})
export class AdvancedAuditModule {}
