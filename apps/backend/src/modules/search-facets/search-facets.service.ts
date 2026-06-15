import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  LegislativeStatus,
  LegislativeItemType,
  ConfidentialityLevel,
  Priority,
} from '@prisma/client';
import { SearchWithFacetsDto, SaveSearchDto } from './dto/search-facets.dto';

@Injectable()
export class SearchFacetsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Facets ────────────────────────────────────────────────────────────────

  async getFacets(_query?: string) {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];

    const [items, ministries] = await Promise.all([
      this.prisma.legislativeItem.findMany({
        select: {
          status: true,
          type: true,
          ministryId: true,
          confidentialityLevel: true,
          priority: true,
          createdAt: true,
        },
      }),
      this.prisma.ministry.findMany({
        select: { id: true, name: true },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byMinistryId: Record<string, number> = {};
    const byConfidentiality: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byYear: Record<number, number> = {};

    for (const item of items) {
      byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
      byType[item.type] = (byType[item.type] ?? 0) + 1;
      byMinistryId[item.ministryId] = (byMinistryId[item.ministryId] ?? 0) + 1;
      byConfidentiality[item.confidentialityLevel] = (byConfidentiality[item.confidentialityLevel] ?? 0) + 1;
      byPriority[item.priority] = (byPriority[item.priority] ?? 0) + 1;
      const year = new Date(item.createdAt).getFullYear();
      byYear[year] = (byYear[year] ?? 0) + 1;
    }

    // Build ministry facet with names
    const ministryMap = new Map(ministries.map((m) => [m.id, m.name]));
    const byMinistry = Object.entries(byMinistryId).map(([id, count]) => ({
      id,
      name: ministryMap.get(id) ?? id,
      count,
    }));

    return {
      byStatus,
      byType,
      byMinistry,
      byConfidentiality,
      byPriority,
      byYear: years.map((y) => ({ year: y, count: byYear[y] ?? 0 })),
    };
  }

  // ── Faceted Search ────────────────────────────────────────────────────────

  async searchWithFacets(dto: SearchWithFacetsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (dto.query) {
      where['title'] = { contains: dto.query, mode: 'insensitive' };
    }
    if (dto.status?.length) where['status'] = { in: dto.status };
    if (dto.type?.length) where['type'] = { in: dto.type };
    if (dto.ministryId?.length) where['ministryId'] = { in: dto.ministryId };
    if (dto.confidentialityLevel?.length) where['confidentialityLevel'] = { in: dto.confidentialityLevel };
    if (dto.priority?.length) where['priority'] = { in: dto.priority };
    if (dto.dateFrom || dto.dateTo) {
      where['createdAt'] = {
        ...(dto.dateFrom ? { gte: new Date(dto.dateFrom) } : {}),
        ...(dto.dateTo ? { lte: new Date(dto.dateTo) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.legislativeItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ministry: { select: { id: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.legislativeItem.count({ where }),
    ]);

    // Get facets for the current result set
    const facets = await this.getFacets(dto.query);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      facets,
    };
  }

  // ── Saved Searches ────────────────────────────────────────────────────────

  async saveSearch(userId: string, dto: SaveSearchDto) {
    return this.prisma.savedSearch.create({
      data: {
        userId,
        name: dto.name,
        query: dto.query,
        filters: (dto.filters ?? {}) as object,
        searchType: dto.searchType ?? 'keyword',
      },
    });
  }

  async getSavedSearches(userId: string) {
    return this.prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { lastRunAt: { sort: 'desc', nulls: 'last' } },
    });
  }

  async deleteSavedSearch(id: string, userId: string) {
    const search = await this.prisma.savedSearch.findUnique({ where: { id } });
    if (!search) throw new NotFoundException(`SavedSearch ${id} not found`);
    if (search.userId !== userId) throw new ForbiddenException('Not your saved search');

    await this.prisma.savedSearch.delete({ where: { id } });
    return { deleted: true };
  }

  async runSavedSearch(id: string, userId: string) {
    const saved = await this.prisma.savedSearch.findUnique({ where: { id } });
    if (!saved) throw new NotFoundException(`SavedSearch ${id} not found`);
    if (saved.userId !== userId) throw new ForbiddenException('Not your saved search');

    // Execute the search using saved filters
    const filters = (saved.filters as Record<string, unknown>) ?? {};
    const result = await this.searchWithFacets({
      query: saved.query,
      status: (filters['status'] as LegislativeStatus[]) ?? undefined,
      type: (filters['type'] as LegislativeItemType[]) ?? undefined,
      ministryId: (filters['ministryId'] as string[]) ?? undefined,
      confidentialityLevel: (filters['confidentialityLevel'] as ConfidentialityLevel[]) ?? undefined,
      priority: (filters['priority'] as Priority[]) ?? undefined,
    });

    // Update hitCount and lastRunAt
    await this.prisma.savedSearch.update({
      where: { id },
      data: {
        hitCount: { increment: 1 },
        lastRunAt: new Date(),
      },
    });

    return result;
  }

  async getSearchAnalytics(userId?: string) {
    const where = userId ? { userId } : {};
    const searches = await this.prisma.savedSearch.findMany({
      where,
      orderBy: { hitCount: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        query: true,
        hitCount: true,
        lastRunAt: true,
        searchType: true,
      },
    });

    return {
      topSavedSearches: searches,
      totalSavedSearches: await this.prisma.savedSearch.count({ where }),
    };
  }
}
