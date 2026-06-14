import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  GraphNode,
  GraphEdge,
  KnowledgeGraph,
  GraphFilters,
} from './graph.models';

@Injectable()
export class KnowledgeGraphService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Build the full knowledge graph
  // ---------------------------------------------------------------------------

  async buildGraph(filters?: GraphFilters): Promise<KnowledgeGraph> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();
    let edgeCounter = 0;

    const addNode = (node: GraphNode) => {
      if (!nodeIds.has(node.id)) {
        nodeIds.add(node.id);
        nodes.push(node);
      }
    };

    const addEdge = (source: string, target: string, label: string, type: string) => {
      edgeCounter++;
      edges.push({ id: `e-${edgeCounter}`, source, target, label, type });
    };

    // Build where clause for legislative items
    const itemWhere: Record<string, unknown> = {};
    if (filters?.ministryId) itemWhere.ministryId = filters.ministryId;
    if (filters?.type) itemWhere.type = filters.type;
    if (filters?.status) itemWhere.status = filters.status;
    if (filters?.dateFrom || filters?.dateTo) {
      itemWhere.createdAt = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      };
    }

    // 1. Fetch Legislative Items
    const items = await this.prisma.legislativeItem.findMany({
      where: itemWhere,
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        referenceNumber: true,
        ministryId: true,
      },
    });

    const itemIdSet = new Set(items.map((i) => i.id));

    for (const item of items) {
      addNode({
        id: item.id,
        label: item.title,
        type: 'LEGISLATIVE_ITEM',
        metadata: {
          type: item.type,
          status: item.status,
          referenceNumber: item.referenceNumber,
          ministryId: item.ministryId,
        },
      });
    }

    if (!items.length) {
      return { nodes, edges };
    }

    const itemIds = Array.from(itemIdSet);

    // 2. Fetch Amendments
    const amendments = await this.prisma.amendment.findMany({
      where: { legislativeItemId: { in: itemIds } },
      select: { id: true, title: true, status: true, legislativeItemId: true },
    });

    for (const amendment of amendments) {
      addNode({
        id: amendment.id,
        label: amendment.title,
        type: 'AMENDMENT',
        metadata: { status: amendment.status, legislativeItemId: amendment.legislativeItemId },
      });
      addEdge(amendment.legislativeItemId, amendment.id, 'HAS_AMENDMENT', 'AMENDMENT_LINK');
    }

    // 3. Fetch Consultations
    const consultations = await this.prisma.consultation.findMany({
      where: { legislativeItemId: { in: itemIds } },
      select: { id: true, title: true, status: true, legislativeItemId: true },
    });

    for (const c of consultations) {
      addNode({
        id: c.id,
        label: c.title,
        type: 'CONSULTATION',
        metadata: { status: c.status, legislativeItemId: c.legislativeItemId },
      });
      addEdge(c.legislativeItemId, c.id, 'HAS_CONSULTATION', 'CONSULTATION_LINK');
    }

    // 4. Fetch CommitteeReviews and their committees
    const committeeReviews = await this.prisma.committeeReview.findMany({
      where: { legislativeItemId: { in: itemIds } },
      select: {
        id: true,
        legislativeItemId: true,
        committee: { select: { id: true, name: true, type: true } },
        recommendation: true,
      },
    });

    for (const review of committeeReviews) {
      if (review.committee) {
        addNode({
          id: review.committee.id,
          label: review.committee.name,
          type: 'COMMITTEE',
          metadata: { type: review.committee.type },
        });
        addEdge(review.committee.id, review.legislativeItemId, 'REVIEWED', 'COMMITTEE_LINK');
      }
    }

    // 5. Fetch RegulatoryReferences
    const regulatoryRefs = await this.prisma.regulatoryReference.findMany({
      where: { legislativeItemId: { in: itemIds } },
      select: { id: true, referencedName: true, referenceType: true, legislativeItemId: true },
    });

    for (const ref of regulatoryRefs) {
      addNode({
        id: ref.id,
        label: ref.referencedName,
        type: 'REGULATION',
        metadata: { referenceType: ref.referenceType },
      });
      addEdge(ref.legislativeItemId, ref.id, 'REFERENCES', 'REGULATORY_LINK');
    }

    // 6. Fetch TraceLinks
    const traceLinks = await this.prisma.traceLink.findMany({
      where: { legislativeItemId: { in: itemIds } },
      select: {
        id: true,
        sourceId: true,
        sourceType: true,
        targetId: true,
        targetType: true,
        linkType: true,
      },
    });

    for (const link of traceLinks) {
      // Ensure source node exists
      if (!nodeIds.has(link.sourceId)) {
        addNode({
          id: link.sourceId,
          label: `${link.sourceType}:${link.sourceId.slice(0, 8)}`,
          type: 'LEGISLATIVE_ITEM',
          metadata: { type: link.sourceType },
        });
      }
      if (!nodeIds.has(link.targetId)) {
        addNode({
          id: link.targetId,
          label: `${link.targetType}:${link.targetId.slice(0, 8)}`,
          type: 'LEGISLATIVE_ITEM',
          metadata: { type: link.targetType },
        });
      }
      addEdge(link.sourceId, link.targetId, link.linkType, 'TRACE_LINK');
    }

    return { nodes, edges };
  }

  // ---------------------------------------------------------------------------
  // Get details for a single node
  // ---------------------------------------------------------------------------

  async getNodeDetail(nodeId: string, nodeType: string): Promise<Record<string, unknown> | null> {
    switch (nodeType.toUpperCase()) {
      case 'LEGISLATIVE_ITEM':
        return this.prisma.legislativeItem.findUnique({
          where: { id: nodeId },
          include: { ministry: { select: { id: true, name: true } } },
        });
      case 'AMENDMENT':
        return this.prisma.amendment.findUnique({ where: { id: nodeId } });
      case 'CONSULTATION':
        return this.prisma.consultation.findUnique({
          where: { id: nodeId },
          include: { _count: { select: { feedback: true } } },
        });
      case 'COMMITTEE':
        return this.prisma.committee.findUnique({ where: { id: nodeId } });
      case 'REGULATION':
        return this.prisma.regulatoryReference.findUnique({ where: { id: nodeId } });
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Get neighbors (subgraph centered on node)
  // ---------------------------------------------------------------------------

  async getNeighbors(
    nodeId: string,
    nodeType: string,
    depth: 1 | 2 = 1,
  ): Promise<KnowledgeGraph> {
    // Start by building the full graph (filtered to relevant items)
    const fullGraph = await this.buildGraph();

    // Find all edges connected to the seed node
    const neighborIds = new Set<string>([nodeId]);
    const relevantEdges: GraphEdge[] = [];

    const expandNeighbors = (ids: Set<string>) => {
      for (const edge of fullGraph.edges) {
        if (ids.has(edge.source) || ids.has(edge.target)) {
          relevantEdges.push(edge);
          neighborIds.add(edge.source);
          neighborIds.add(edge.target);
        }
      }
    };

    expandNeighbors(neighborIds);

    if (depth === 2) {
      const firstLevelIds = new Set(neighborIds);
      expandNeighbors(firstLevelIds);
    }

    const relevantNodes = fullGraph.nodes.filter((n) => neighborIds.has(n.id));

    // Deduplicate edges
    const seenEdges = new Set<string>();
    const uniqueEdges = relevantEdges.filter((e) => {
      if (seenEdges.has(e.id)) return false;
      seenEdges.add(e.id);
      return true;
    });

    return { nodes: relevantNodes, edges: uniqueEdges };
  }
}
