import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // System Settings
  // ---------------------------------------------------------------------------

  async getSetting(key: string) {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!setting) throw new NotFoundException(`Setting "${key}" not found`);
    return setting;
  }

  async getPublicSettings() {
    return this.prisma.systemSetting.findMany({
      where: { isPublic: true },
      orderBy: { key: 'asc' },
    });
  }

  async getAllSettings() {
    return this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async updateSetting(key: string, value: Prisma.InputJsonValue, description?: string) {
    return this.prisma.systemSetting.upsert({
      where: { key },
      create: {
        key,
        value,
        description: description ?? '',
        isPublic: false,
      },
      update: {
        value,
        ...(description !== undefined ? { description } : {}),
        updatedAt: new Date(),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Workflow Configuration
  // ---------------------------------------------------------------------------

  async getWorkflowConfig() {
    const settings = await this.prisma.systemSetting.findMany({
      where: { key: { startsWith: 'workflow.' } },
      orderBy: { key: 'asc' },
    });

    return settings.reduce<Record<string, unknown>>((acc, s) => {
      const shortKey = s.key.replace('workflow.', '');
      acc[shortKey] = s.value;
      return acc;
    }, {});
  }

  async updateWorkflowConfig(config: Record<string, unknown>) {
    const results: Array<{ key: string; updated: boolean }> = [];
    for (const [k, v] of Object.entries(config)) {
      await this.updateSetting(
        `workflow.${k}`,
        v as Prisma.InputJsonValue,
        `Workflow configuration: ${k}`,
      );
      results.push({ key: `workflow.${k}`, updated: true });
    }
    return { updated: results };
  }

  // ---------------------------------------------------------------------------
  // AI Provider Configuration
  // ---------------------------------------------------------------------------

  async getAiProviderConfig() {
    const settings = await this.prisma.systemSetting.findMany({
      where: { key: { startsWith: 'ai.' } },
      orderBy: { key: 'asc' },
    });

    const config: Record<string, unknown> = {};
    for (const s of settings) {
      const shortKey = s.key.replace('ai.', '');
      let value = s.value;

      // Mask API keys (any key containing "key", "secret", "token")
      if (
        shortKey.toLowerCase().includes('key') ||
        shortKey.toLowerCase().includes('secret') ||
        shortKey.toLowerCase().includes('token')
      ) {
        value = '****';
      }

      config[shortKey] = value;
    }

    return config;
  }

  async updateAiProviderConfig(provider: string, config: Record<string, unknown>) {
    const results: Array<{ key: string; updated: boolean }> = [];

    for (const [k, v] of Object.entries(config)) {
      // Do not store API keys — they must remain in env
      if (
        k.toLowerCase().includes('key') ||
        k.toLowerCase().includes('secret') ||
        k.toLowerCase().includes('token')
      ) {
        results.push({ key: `ai.${provider}.${k}`, updated: false });
        continue;
      }

      await this.updateSetting(
        `ai.${provider}.${k}`,
        v as Prisma.InputJsonValue,
        `AI provider ${provider}: ${k}`,
      );
      results.push({ key: `ai.${provider}.${k}`, updated: true });
    }

    return { provider, updated: results };
  }

  // ---------------------------------------------------------------------------
  // Ministry Management
  // ---------------------------------------------------------------------------

  async getMinistries() {
    return this.prisma.ministry.findMany({ orderBy: { name: 'asc' } });
  }

  async createMinistry(dto: { name: string; code: string; description?: string }) {
    return this.prisma.ministry.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
      },
    });
  }

  async updateMinistry(id: string, dto: { name?: string; code?: string; description?: string }) {
    const existing = await this.prisma.ministry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Ministry ${id} not found`);
    return this.prisma.ministry.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Security Settings
  // ---------------------------------------------------------------------------

  async getSecuritySettings() {
    const settings = await this.prisma.systemSetting.findMany({
      where: { key: { startsWith: 'security.' } },
      orderBy: { key: 'asc' },
    });

    return settings.reduce<Record<string, unknown>>((acc, s) => {
      acc[s.key.replace('security.', '')] = s.value;
      return acc;
    }, {});
  }

  async updateSecuritySettings(dto: Record<string, unknown>) {
    const results: Array<{ key: string; updated: boolean }> = [];
    for (const [k, v] of Object.entries(dto)) {
      await this.updateSetting(
        `security.${k}`,
        v as Prisma.InputJsonValue,
        `Security setting: ${k}`,
      );
      results.push({ key: `security.${k}`, updated: true });
    }
    return { updated: results };
  }
}
