import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTraceLinkDto } from './dto/traceability.dto';

export interface TraceNode {
  id: string;
  label: string;
  type: string;
}

export interface TraceEdge {
  from: string;
  to: string;
  label: string;
}

export interface TraceGraph {
  nodes: TraceNode[];
  edges: TraceEdge[];
}

@Injectable()
export class TraceabilityService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Create trace link
  // ---------------------------------------------------------------------------

  async createLink(legislativeItemId: string, dto: CreateTraceLinkDto) {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: legislativeItemId },
    });
    if (!item) throw new NotFoundException(`Legislative item ${legislativeItemId} not found`);

    return this.prisma.traceLink.create({
      data: {
        legislativeItemId,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        linkType: dto.linkType,
        description: dto.description ?? null,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Get trace links with optional filters
  // ---------------------------------------------------------------------------

  async getLinks(
    legislativeItemId: string,
    filters?: { sourceType?: string; targetType?: string; linkType?: string },
  ) {
    return this.prisma.traceLink.findMany({
      where: {
        legislativeItemId,
        ...(filters?.sourceType ? { sourceType: filters.sourceType } : {}),
        ...(filters?.targetType ? { targetType: filters.targetType } : {}),
        ...(filters?.linkType ? { linkType: filters.linkType } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Build graph
  // ---------------------------------------------------------------------------

  async getGraph(legislativeItemId: string): Promise<TraceGraph> {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: legislativeItemId },
      select: { id: true, title: true },
    });
    if (!item) throw new NotFoundException(`Legislative item ${legislativeItemId} not found`);

    const links = await this.prisma.traceLink.findMany({
      where: { legislativeItemId },
    });

    const nodeMap = new Map<string, TraceNode>();
    nodeMap.set(item.id, { id: item.id, label: item.title, type: 'LEGISLATIVE_ITEM' });

    const edges: TraceEdge[] = [];

    for (const link of links) {
      if (!nodeMap.has(link.sourceId)) {
        nodeMap.set(link.sourceId, {
          id: link.sourceId,
          label: `${link.sourceType}:${link.sourceId.slice(0, 8)}`,
          type: link.sourceType,
        });
      }
      if (!nodeMap.has(link.targetId)) {
        nodeMap.set(link.targetId, {
          id: link.targetId,
          label: `${link.targetType}:${link.targetId.slice(0, 8)}`,
          type: link.targetType,
        });
      }
      edges.push({ from: link.sourceId, to: link.targetId, label: link.linkType });
    }

    return { nodes: Array.from(nodeMap.values()), edges };
  }

  // ---------------------------------------------------------------------------
  // Audit trail
  // ---------------------------------------------------------------------------

  async getAuditTrail(legislativeItemId: string) {
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: legislativeItemId },
    });
    if (!item) throw new NotFoundException(`Legislative item ${legislativeItemId} not found`);

    return this.prisma.auditLog.findMany({
      where: {
        entityType: 'LegislativeItem',
        entityId: legislativeItemId,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Delete trace link
  // ---------------------------------------------------------------------------

  async deleteLink(id: string) {
    const link = await this.prisma.traceLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException(`Trace link ${id} not found`);
    return this.prisma.traceLink.delete({ where: { id } });
  }
}
