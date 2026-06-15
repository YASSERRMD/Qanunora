import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateAdapterDto, UpdateAdapterDto, RegistryType } from './dto/registry-adapters.dto';
import { IRegistryAdapter } from './adapters/registry-adapter.interface';
import { EntityRegistryAdapter } from './adapters/entity-registry.adapter';
import { MinistryRegistryAdapter } from './adapters/ministry-registry.adapter';
import { GazetteRegistryAdapter } from './adapters/gazette-registry.adapter';
import { LegalReferenceRegistryAdapter } from './adapters/legal-reference-registry.adapter';
import { PersonnelRegistryAdapter } from './adapters/personnel-registry.adapter';

@Injectable()
export class RegistryAdaptersService {
  private readonly logger = new Logger(RegistryAdaptersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Adapter Factory ───────────────────────────────────────────────────────

  getAdapterInstance(registryType: RegistryType): IRegistryAdapter {
    switch (registryType) {
      case RegistryType.ENTITY_REGISTRY:
        return new EntityRegistryAdapter();
      case RegistryType.MINISTRY_REGISTRY:
        return new MinistryRegistryAdapter();
      case RegistryType.GAZETTE_REGISTRY:
        return new GazetteRegistryAdapter();
      case RegistryType.LEGAL_REFERENCE_REGISTRY:
        return new LegalReferenceRegistryAdapter();
      case RegistryType.PERSONNEL_REGISTRY:
        return new PersonnelRegistryAdapter();
      default:
        throw new BadRequestException(`Unknown registry type: ${String(registryType)}`);
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async createAdapter(dto: CreateAdapterDto) {
    return this.prisma.registryAdapter.create({
      data: {
        name: dto.name,
        registryType: dto.registryType,
        baseUrl: dto.baseUrl,
        config: dto.config ?? {},
      },
    });
  }

  async listAdapters() {
    return this.prisma.registryAdapter.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { syncLogs: true } } },
    });
  }

  async getAdapterById(id: string) {
    const adapter = await this.prisma.registryAdapter.findUnique({
      where: { id },
      include: { syncLogs: { orderBy: { startedAt: 'desc' }, take: 10 } },
    });
    if (!adapter) throw new NotFoundException('Registry adapter not found');
    return adapter;
  }

  async updateAdapter(id: string, dto: UpdateAdapterDto) {
    await this.getAdapterById(id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data['name'] = dto.name;
    if (dto.baseUrl !== undefined) data['baseUrl'] = dto.baseUrl;
    if (dto.config !== undefined) data['config'] = dto.config;
    return this.prisma.registryAdapter.update({ where: { id }, data });
  }

  async enableAdapter(id: string) {
    await this.getAdapterById(id);
    return this.prisma.registryAdapter.update({ where: { id }, data: { isEnabled: true } });
  }

  async disableAdapter(id: string) {
    await this.getAdapterById(id);
    return this.prisma.registryAdapter.update({ where: { id }, data: { isEnabled: false } });
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  async triggerSync(adapterId: string) {
    const adapterRecord = await this.getAdapterById(adapterId);
    if (!adapterRecord.isEnabled) {
      throw new BadRequestException('Adapter is not enabled');
    }

    const log = await this.prisma.registrySyncLog.create({
      data: {
        adapterId,
        syncType: 'FULL_SYNC',
        startedAt: new Date(),
      },
    });

    const adapterInstance = this.getAdapterInstance(adapterRecord.registryType as RegistryType);
    let success = false;
    let recordsIn = 0;
    let errors: string[] = [];

    try {
      const result = await adapterInstance.sync();
      recordsIn = result.records.length;
      errors = result.errors;
      success = errors.length === 0;

      await this.prisma.registryAdapter.update({
        where: { id: adapterId },
        data: { lastSyncAt: new Date() },
      });
    } catch (err) {
      errors = [err instanceof Error ? err.message : String(err)];
    }

    return this.prisma.registrySyncLog.update({
      where: { id: log.id },
      data: {
        recordsIn,
        success,
        errors: errors as never,
        completedAt: new Date(),
      },
    });
  }

  async pushToRegistry(adapterId: string, data: Record<string, unknown>) {
    const adapterRecord = await this.getAdapterById(adapterId);
    if (!adapterRecord.isEnabled) {
      throw new BadRequestException('Adapter is not enabled');
    }

    const adapterInstance = this.getAdapterInstance(adapterRecord.registryType as RegistryType);
    const log = await this.prisma.registrySyncLog.create({
      data: {
        adapterId,
        syncType: 'PUSH',
        startedAt: new Date(),
      },
    });

    let success = false;
    let errors: string[] = [];
    let recordsOut = 0;

    try {
      const result = await adapterInstance.push(data);
      success = result.success;
      recordsOut = 1;
    } catch (err) {
      errors = [err instanceof Error ? err.message : String(err)];
    }

    return this.prisma.registrySyncLog.update({
      where: { id: log.id },
      data: {
        recordsOut,
        success,
        errors: errors as never,
        completedAt: new Date(),
      },
    });
  }

  async getSyncLogs(adapterId?: string) {
    const where = adapterId ? { adapterId } : {};
    return this.prisma.registrySyncLog.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 100,
      include: { adapter: { select: { name: true, registryType: true } } },
    });
  }
}
