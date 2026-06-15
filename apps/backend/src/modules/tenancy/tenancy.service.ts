import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenancyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`Tenant with slug "${dto.slug}" already exists`);
    }
    return this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        isActive: dto.isActive ?? true,
        settings: (dto.settings as object) ?? {},
      },
    });
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException(`Tenant with slug "${slug}" not found`);
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findById(id);
    if (dto.slug) {
      const conflict = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(`Tenant slug "${dto.slug}" already taken`);
      }
    }
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.settings !== undefined && { settings: dto.settings as object }),
      },
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.tenant.delete({ where: { id } });
    return { deleted: true };
  }

  async addUserToTenant(tenantId: string, userId: string) {
    await this.findById(tenantId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { tenantId },
    });
  }

  async getTenantStats(tenantId: string) {
    await this.findById(tenantId);

    const [userCount, ministryCount] = await Promise.all([
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.ministry.count({ where: { tenantId } }),
    ]);

    const ministryIds = await this.prisma.ministry
      .findMany({ where: { tenantId }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id));

    const itemCount = await this.prisma.legislativeItem.count({
      where: { ministryId: { in: ministryIds } },
    });

    return {
      tenantId,
      userCount,
      ministryCount,
      itemCount,
    };
  }
}
