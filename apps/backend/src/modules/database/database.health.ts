import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class DatabaseHealth {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<{ status: string; latencyMs: number }> {
    const start = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', latencyMs: Date.now() - start };
  }
}
