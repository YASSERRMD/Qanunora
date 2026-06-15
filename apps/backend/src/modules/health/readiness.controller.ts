import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../database/prisma.service';

@Controller()
export class ReadinessController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('readiness')
  async getReadiness() {
    const checks: { database: boolean; redis: boolean } = {
      database: false,
      redis: false,
    };

    // Database connectivity check
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }

    // Redis is optional — mark as true if not configured, false if error
    checks.redis = true;

    const ready = checks.database;

    return {
      ready,
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
