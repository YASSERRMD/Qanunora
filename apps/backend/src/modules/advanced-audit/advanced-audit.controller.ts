import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditChainService } from './audit-chain.service';
import { QueryAuditEntriesDto, UpsertRetentionPolicyDto } from './dto/record-event.dto';

@Controller('audit-chain')
@UseGuards(RolesGuard)
@Roles('AUDITOR', 'SUPER_ADMIN')
export class AdvancedAuditController {
  constructor(private readonly auditChainService: AuditChainService) {}

  @Get('entries')
  getEntries(@Query() query: QueryAuditEntriesDto) {
    return this.auditChainService.getEntries(query);
  }

  @Get('verify')
  verifyChain(@Query('limit') limit?: string) {
    return this.auditChainService.verifyChainIntegrity(limit ? parseInt(limit, 10) : undefined);
  }

  @Get('evidence/:entityType/:entityId')
  exportEvidence(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('format') format: 'json' | 'csv' = 'json',
  ) {
    return this.auditChainService.exportEvidence(entityType, entityId, format);
  }

  @Get('retention')
  getRetentionPolicies() {
    return this.auditChainService.getRetentionPolicies();
  }

  @Put('retention/:entityType')
  upsertRetentionPolicy(
    @Param('entityType') entityType: string,
    @Body() dto: UpsertRetentionPolicyDto,
  ) {
    return this.auditChainService.upsertRetentionPolicy(entityType, dto);
  }
}
