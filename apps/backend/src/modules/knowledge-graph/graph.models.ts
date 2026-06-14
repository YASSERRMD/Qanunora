export type GraphNodeType =
  | 'LEGISLATIVE_ITEM'
  | 'BILL'
  | 'AMENDMENT'
  | 'COMMITTEE'
  | 'STAKEHOLDER'
  | 'CONSULTATION'
  | 'REGULATION';

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphFilters {
  ministryId?: string;
  type?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}
