import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { encryptApiKey, decryptApiKey } from '../../common/utils/encryption.util';
import {
  CreateProviderDto,
  UpdateProviderDto,
  CreateGroupMappingDto,
  JitProvisionDto,
  SimulateJitDto,
} from './dto/sso.dto';

const DEFAULT_ROLE = 'VIEWER';

@Injectable()
export class SsoService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Provider Management ───────────────────────────────────────────────────

  async createProvider(dto: CreateProviderDto, userId: string) {
    const encryptedConfig = encryptApiKey(JSON.stringify(dto.config));
    return this.prisma.identityProvider.create({
      data: {
        name: dto.name,
        type: dto.type,
        config: { encrypted: encryptedConfig },
        createdById: userId,
      },
    });
  }

  async listProviders() {
    const providers = await this.prisma.identityProvider.findMany({
      orderBy: { name: 'asc' },
      include: { groupMappings: true },
    });

    // Mask config secrets in list view
    return providers.map((p) => ({
      ...p,
      config: { type: p.type, encrypted: true },
    }));
  }

  async getProvider(id: string) {
    const provider = await this.prisma.identityProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Identity provider not found');

    const configBlob = provider.config as { encrypted?: string };
    let decryptedConfig: Record<string, unknown> = {};
    if (configBlob.encrypted) {
      try {
        decryptedConfig = JSON.parse(decryptApiKey(configBlob.encrypted)) as Record<string, unknown>;
      } catch {
        decryptedConfig = {};
      }
    }

    return { ...provider, config: decryptedConfig };
  }

  async updateProvider(id: string, dto: UpdateProviderDto) {
    const data: Record<string, unknown> = {};
    if (dto.name) data['name'] = dto.name;
    if (dto.config) {
      data['config'] = { encrypted: encryptApiKey(JSON.stringify(dto.config)) };
    }

    return this.prisma.identityProvider.update({ where: { id }, data });
  }

  async activateProvider(id: string) {
    return this.prisma.identityProvider.update({ where: { id }, data: { isActive: true } });
  }

  async deactivateProvider(id: string) {
    return this.prisma.identityProvider.update({ where: { id }, data: { isActive: false } });
  }

  async deleteProvider(id: string) {
    return this.prisma.identityProvider.delete({ where: { id } });
  }

  // ── Group Mappings ────────────────────────────────────────────────────────

  async createGroupMapping(providerId: string, dto: CreateGroupMappingDto) {
    return this.prisma.idpGroupMapping.create({
      data: { providerId, groupName: dto.groupName, role: dto.role },
    });
  }

  async getGroupMappings(providerId: string) {
    return this.prisma.idpGroupMapping.findMany({ where: { providerId } });
  }

  async deleteGroupMapping(id: string) {
    return this.prisma.idpGroupMapping.delete({ where: { id } });
  }

  // ── JIT Provisioning ──────────────────────────────────────────────────────

  async jitProvision(dto: JitProvisionDto) {
    const provider = await this.prisma.identityProvider.findUnique({ where: { id: dto.providerId } });
    if (!provider) throw new NotFoundException('Identity provider not found');

    // Find existing mapping
    const existingMapping = await this.prisma.idpUserMapping.findUnique({
      where: { providerId_externalId: { providerId: dto.providerId, externalId: dto.externalId } },
      include: { user: true },
    });

    if (existingMapping) {
      await this.prisma.idpUserMapping.update({
        where: { id: existingMapping.id },
        data: { lastLoginAt: new Date() },
      });
      return existingMapping.user;
    }

    // Resolve role from group mappings
    let role = DEFAULT_ROLE;
    if (dto.externalGroups && dto.externalGroups.length > 0) {
      const groupMappings = await this.prisma.idpGroupMapping.findMany({
        where: { providerId: dto.providerId, groupName: { in: dto.externalGroups } },
      });
      if (groupMappings.length > 0) {
        role = groupMappings[0].role;
      }
    }

    // Create new user
    const email = dto.externalEmail ?? `${dto.externalId}@sso.local`;
    const newUser = await this.prisma.user.create({
      data: {
        email,
        passwordHash: '',
        firstName: dto.givenName ?? 'SSO',
        lastName: dto.familyName ?? 'User',
        role: role as never,
        isActive: true,
      },
    });

    // Create IdP mapping
    await this.prisma.idpUserMapping.create({
      data: {
        providerId: dto.providerId,
        userId: newUser.id,
        externalId: dto.externalId,
        externalEmail: dto.externalEmail,
        lastLoginAt: new Date(),
      },
    });

    return newUser;
  }

  async createUserMapping(providerId: string, userId: string, externalId: string, externalEmail?: string) {
    return this.prisma.idpUserMapping.create({
      data: { providerId, userId, externalId, externalEmail },
    });
  }

  async getUserMappings(userId: string) {
    return this.prisma.idpUserMapping.findMany({
      where: { userId },
      include: { provider: { select: { name: true, type: true } } },
    });
  }

  async simulateJit(dto: SimulateJitDto) {
    const provider = await this.prisma.identityProvider.findUnique({ where: { id: dto.providerId } });
    if (!provider) throw new NotFoundException('Identity provider not found');

    // Check existing mapping
    const existingMapping = await this.prisma.idpUserMapping.findUnique({
      where: { providerId_externalId: { providerId: dto.providerId, externalId: dto.externalId } },
      include: { user: { select: { id: true, email: true, role: true } } },
    });

    if (existingMapping) {
      return {
        action: 'LOGIN_EXISTING_USER',
        existingUserId: existingMapping.userId,
        existingEmail: existingMapping.user.email,
        role: existingMapping.user.role,
        wouldCreate: false,
      };
    }

    // Simulate role resolution
    let role = DEFAULT_ROLE;
    const matchedGroups: string[] = [];
    if (dto.externalGroups && dto.externalGroups.length > 0) {
      const groupMappings = await this.prisma.idpGroupMapping.findMany({
        where: { providerId: dto.providerId, groupName: { in: dto.externalGroups } },
      });
      if (groupMappings.length > 0) {
        role = groupMappings[0].role;
        matchedGroups.push(groupMappings[0].groupName);
      }
    }

    return {
      action: 'CREATE_NEW_USER',
      role,
      matchedGroups,
      wouldCreate: true,
    };
  }
}
