import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SecurityControlsService } from './security-controls.service';
import { CreateIpRestrictionDto } from './dto/security-controls.dto';

interface AuthRequest {
  user: { id: string };
}

@Controller('security')
@UseGuards(RolesGuard)
export class SecurityControlsController {
  constructor(private readonly securityService: SecurityControlsService) {}

  // ── Sessions ────────────────────────────────────────────────────────────

  @Get('sessions')
  @Roles('VIEWER', 'REVIEWER', 'LEGISLATIVE_ADMIN', 'SUPER_ADMIN', 'AUDITOR', 'COMMITTEE_MEMBER', 'MINISTRY_LEGAL_OFFICER', 'DRAFTING_OFFICER', 'STAKEHOLDER_MANAGER', 'PUBLIC_CONSULTATION_OFFICER')
  getMyActiveSessions(@Req() req: AuthRequest) {
    return this.securityService.getActiveSessions(req.user.id);
  }

  @Delete('sessions/:id')
  @Roles('VIEWER', 'REVIEWER', 'LEGISLATIVE_ADMIN', 'SUPER_ADMIN', 'AUDITOR', 'COMMITTEE_MEMBER', 'MINISTRY_LEGAL_OFFICER', 'DRAFTING_OFFICER', 'STAKEHOLDER_MANAGER', 'PUBLIC_CONSULTATION_OFFICER')
  revokeSession(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.securityService.revokeSession(id, req.user.id);
  }

  @Delete('sessions')
  @Roles('VIEWER', 'REVIEWER', 'LEGISLATIVE_ADMIN', 'SUPER_ADMIN', 'AUDITOR', 'COMMITTEE_MEMBER', 'MINISTRY_LEGAL_OFFICER', 'DRAFTING_OFFICER', 'STAKEHOLDER_MANAGER', 'PUBLIC_CONSULTATION_OFFICER')
  revokeAllSessions(@Query('except') exceptSessionId: string, @Req() req: AuthRequest) {
    return this.securityService.revokeAllSessions(req.user.id, exceptSessionId);
  }

  @Get('login-history')
  @Roles('VIEWER', 'REVIEWER', 'LEGISLATIVE_ADMIN', 'SUPER_ADMIN', 'AUDITOR', 'COMMITTEE_MEMBER', 'MINISTRY_LEGAL_OFFICER', 'DRAFTING_OFFICER', 'STAKEHOLDER_MANAGER', 'PUBLIC_CONSULTATION_OFFICER')
  getMyLoginHistory(@Req() req: AuthRequest, @Query('limit') limit?: string) {
    return this.securityService.getLoginHistory(req.user.id, limit ? parseInt(limit, 10) : undefined);
  }

  // ── IP Restrictions ──────────────────────────────────────────────────────

  @Get('ip-restrictions')
  @Roles('SUPER_ADMIN')
  listIpRestrictions() {
    return this.securityService.listIpRestrictions();
  }

  @Post('ip-restrictions')
  @Roles('SUPER_ADMIN')
  createIpRestriction(@Body() dto: CreateIpRestrictionDto, @Req() req: AuthRequest) {
    return this.securityService.createIpRestriction(dto, req.user.id);
  }

  @Delete('ip-restrictions/:id')
  @Roles('SUPER_ADMIN')
  deleteIpRestriction(@Param('id') id: string) {
    return this.securityService.deleteIpRestriction(id);
  }

  // ── Suspicious Activities ────────────────────────────────────────────────

  @Get('suspicious')
  @Roles('SUPER_ADMIN', 'AUDITOR')
  getSuspiciousActivities(@Query('isResolved') isResolved?: string) {
    const resolved = isResolved !== undefined ? isResolved === 'true' : undefined;
    return this.securityService.getSuspiciousActivities(resolved);
  }

  @Patch('suspicious/:id/resolve')
  @Roles('SUPER_ADMIN')
  resolveActivity(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.securityService.resolveActivity(id, req.user.id);
  }
}
