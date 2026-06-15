import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateIpRestrictionDto, RecordLoginDto } from './dto/security-controls.dto';

@Injectable()
export class SecurityControlsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Session Management ────────────────────────────────────────────────────

  async createSession(
    userId: string,
    token: string,
    deviceInfo: Record<string, unknown>,
    ipAddress: string | undefined,
    userAgent: string | undefined,
    expiresAt: Date,
  ) {
    return this.prisma.userSession.create({
      data: {
        userId,
        sessionToken: token,
        deviceInfo,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });
  }

  async getActiveSessions(userId: string) {
    return this.prisma.userSession.findMany({
      where: { userId, isActive: true },
      orderBy: { lastActivityAt: 'desc' },
    });
  }

  async revokeSession(sessionId: string, revokedById: string) {
    return this.prisma.userSession.update({
      where: { id: sessionId },
      data: { isActive: false, revokedAt: new Date(), revokedById },
    });
  }

  async revokeAllSessions(userId: string, exceptSessionId?: string) {
    return this.prisma.userSession.updateMany({
      where: {
        userId,
        isActive: true,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { isActive: false, revokedAt: new Date(), revokedById: userId },
    });
  }

  // ── Login History ─────────────────────────────────────────────────────────

  async recordLogin(dto: RecordLoginDto) {
    await this.prisma.loginHistory.create({
      data: {
        email: dto.email,
        userId: dto.userId,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
        success: dto.success,
        failReason: dto.failReason,
      },
    });

    // Brute force detection: 5 failures within 10 minutes
    if (!dto.success) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const recentFailures = await this.prisma.loginHistory.count({
        where: {
          email: dto.email,
          success: false,
          createdAt: { gte: tenMinutesAgo },
        },
      });

      if (recentFailures >= 5) {
        await this.recordSuspiciousActivity(
          'BRUTE_FORCE',
          { email: dto.email, failureCount: recentFailures, window: '10min' },
          dto.userId,
          dto.email,
          dto.ipAddress,
          0.9,
        );
      }
    }
  }

  async getLoginHistory(userId?: string, limit = 50) {
    return this.prisma.loginHistory.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ── IP Restrictions ───────────────────────────────────────────────────────

  async createIpRestriction(dto: CreateIpRestrictionDto, createdById: string) {
    return this.prisma.ipRestriction.create({
      data: {
        ipAddress: dto.ipAddress,
        type: dto.type,
        reason: dto.reason,
        createdById,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async checkIpRestriction(ipAddress: string): Promise<{ blocked: boolean; reason?: string }> {
    const restriction = await this.prisma.ipRestriction.findFirst({
      where: {
        ipAddress,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!restriction) return { blocked: false };

    if (restriction.type === 'ALLOW') return { blocked: false };
    return { blocked: true, reason: restriction.reason ?? 'IP blocked' };
  }

  async listIpRestrictions() {
    return this.prisma.ipRestriction.findMany({
      include: { createdBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteIpRestriction(id: string) {
    return this.prisma.ipRestriction.update({ where: { id }, data: { isActive: false } });
  }

  // ── Suspicious Activity ───────────────────────────────────────────────────

  async recordSuspiciousActivity(
    type: 'BRUTE_FORCE' | 'UNUSUAL_LOCATION' | 'MASS_EXPORT' | 'PRIVILEGE_ESCALATION' | 'OFF_HOURS_ACCESS',
    details: Record<string, unknown>,
    userId?: string,
    email?: string,
    ipAddress?: string,
    riskScore = 0.5,
  ) {
    return this.prisma.suspiciousActivity.create({
      data: {
        activityType: type,
        details,
        userId,
        email,
        ipAddress,
        riskScore,
      },
    });
  }

  async getSuspiciousActivities(isResolved?: boolean) {
    return this.prisma.suspiciousActivity.findMany({
      where: isResolved !== undefined ? { isResolved } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveActivity(id: string, resolverId: string) {
    return this.prisma.suspiciousActivity.update({
      where: { id },
      data: { isResolved: true, resolvedById: resolverId, resolvedAt: new Date() },
    });
  }

  async detectMassExport(userId: string, windowMinutes = 15, threshold = 10) {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
    const count = await this.prisma.auditLog.count({
      where: {
        userId,
        action: 'EXPORT',
        createdAt: { gte: windowStart },
      },
    });

    if (count >= threshold) {
      return this.recordSuspiciousActivity(
        'MASS_EXPORT',
        { userId, count, windowMinutes, threshold },
        userId,
        undefined,
        undefined,
        0.8,
      );
    }

    return null;
  }
}
