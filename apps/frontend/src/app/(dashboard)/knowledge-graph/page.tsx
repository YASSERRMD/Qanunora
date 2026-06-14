'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

const NODE_TYPE_COLORS: Record<string, string> = {
  LEGISLATIVE_ITEM: 'bg-blue-100 text-blue-700',
  AMENDMENT: 'bg-yellow-100 text-yellow-700',
  CONSULTATION: 'bg-green-100 text-green-700',
  COMMITTEE: 'bg-purple-100 text-purple-700',
  REGULATION: 'bg-orange-100 text-orange-700',
  STAKEHOLDER: 'bg-teal-100 text-teal-700',
  BILL: 'bg-indigo-100 text-indigo-700',
};

interface GraphNode {
  id: string;
  label: string;
  type: string;
  metadata: Record<string, unknown>;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
}

interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface NodeDetail {
  id: string;
  [key: string]: unknown;
}

export default function KnowledgeGraphPage() {
  const [filters, setFilters] = useState({ ministryId: '', type: '', status: '' });
  const [appliedFilters, setAppliedFilters] = useState({ ministryId: '', type: '', status: '' });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [activeTab, setActiveTab] = useState<'nodes' | 'edges'>('nodes');

  const { data: graph, isLoading, refetch } = useQuery({
    queryKey: ['knowledge-graph', appliedFilters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (appliedFilters.ministryId) params.ministryId = appliedFilters.ministryId;
      if (appliedFilters.type) params.type = appliedFilters.type;
      if (appliedFilters.status) params.status = appliedFilters.status;
      const res = await apiClient.get<KnowledgeGraph>('/knowledge-graph', { params });
      return res.data;
    },
  });

  const { data: nodeDetail } = useQuery({
    queryKey: ['graph-node-detail', selectedNode?.type, selectedNode?.id],
    queryFn: async () => {
      if (!selectedNode) return null;
      const res = await apiClient.get<NodeDetail>(
        `/knowledge-graph/node/${selectedNode.type}/${selectedNode.id}`,
      );
      return res.data;
    },
    enabled: !!selectedNode,
  });

  const handleBuildGraph = () => {
    setAppliedFilters({ ...filters });
  };

  // Node type breakdown
  const typeCounts: Record<string, number> = {};
  for (const node of graph?.nodes ?? []) {
    typeCounts[node.type] = (typeCounts[node.type] ?? 0) + 1;
  }

  const nodesByType = Object.entries(typeCounts).sort(([, a], [, b]) => b - a);

  const getLabelForNode = (id: string) =>
    graph?.nodes.find((n) => n.id === id)?.label ?? id.slice(0, 12) + '…';

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary-navy">Legislative Knowledge Graph</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Explore relationships between legislative items, amendments, consultations, committees, and regulations.
          </p>
        </div>

        {/* Filter Panel */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm mb-6">
          <h2 className="font-semibold text-primary-navy mb-3">Filters</h2>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Ministry ID</label>
              <input
                type="text"
                value={filters.ministryId}
                onChange={(e) => setFilters((f) => ({ ...f, ministryId: e.target.value }))}
                placeholder="Filter by ministry..."
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-navy"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Item Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-navy bg-white"
              >
                <option value="">All Types</option>
                <option value="BILL">Bill</option>
                <option value="LAW">Law</option>
                <option value="REGULATION">Regulation</option>
                <option value="DECREE">Decree</option>
                <option value="RESOLUTION">Resolution</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-navy bg-white"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="LEGAL_REVIEW">Legal Review</option>
                <option value="COMMITTEE_REVIEW">Committee Review</option>
                <option value="APPROVED">Approved</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleBuildGraph}
                className="w-full rounded-lg bg-primary-navy px-4 py-2 text-sm font-medium text-white hover:bg-primary-navy/90"
              >
                Build Graph
              </button>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        {graph && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl border border-border bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-primary-navy">{graph.nodes.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Nodes</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-primary-navy">{graph.edges.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Edges</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground mb-2">Node Type Breakdown</p>
              <div className="flex flex-wrap gap-1">
                {nodesByType.map(([type, count]) => (
                  <span
                    key={type}
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      NODE_TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {type} ({count})
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            Building graph...
          </div>
        ) : graph ? (
          <div className="grid grid-cols-3 gap-6">
            {/* Main panel */}
            <div className="col-span-2 rounded-xl border border-border bg-white shadow-sm overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => setActiveTab('nodes')}
                  className={`px-5 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'nodes'
                      ? 'text-primary-navy border-b-2 border-primary-navy'
                      : 'text-muted-foreground hover:text-primary-navy'
                  }`}
                >
                  Nodes ({graph.nodes.length})
                </button>
                <button
                  onClick={() => setActiveTab('edges')}
                  className={`px-5 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'edges'
                      ? 'text-primary-navy border-b-2 border-primary-navy'
                      : 'text-muted-foreground hover:text-primary-navy'
                  }`}
                >
                  Edges ({graph.edges.length})
                </button>
              </div>

              {activeTab === 'nodes' && (
                <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                  {graph.nodes.map((node) => (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-muted/20 transition-colors ${
                        selectedNode?.id === node.id ? 'bg-muted/30 border-l-2 border-primary-gold' : ''
                      }`}
                    >
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          NODE_TYPE_COLORS[node.type] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {node.type.replace('_', ' ')}
                      </span>
                      <span className="text-sm text-primary-navy flex-1 truncate">{node.label}</span>
                      <span className="text-xs text-muted-foreground font-mono shrink-0">
                        {node.id.slice(0, 8)}
                      </span>
                    </div>
                  ))}
                  {!graph.nodes.length && (
                    <div className="px-5 py-12 text-center text-muted-foreground text-sm">
                      No nodes found. Try adjusting filters and building the graph.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'edges' && (
                <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                  {graph.edges.map((edge) => (
                    <div key={edge.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-sm text-primary-navy truncate flex-1">
                        {getLabelForNode(edge.source)}
                      </span>
                      <span className="shrink-0 text-xs font-medium text-primary-gold bg-primary-gold/10 rounded px-2 py-0.5">
                        {edge.label}
                      </span>
                      <span className="text-sm text-primary-navy truncate flex-1 text-right">
                        {getLabelForNode(edge.target)}
                      </span>
                    </div>
                  ))}
                  {!graph.edges.length && (
                    <div className="px-5 py-12 text-center text-muted-foreground text-sm">
                      No edges found.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Node detail panel */}
            <div className="rounded-xl border border-border bg-white shadow-sm p-5">
              {selectedNode ? (
                <>
                  <div className="mb-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium mb-2 ${
                        NODE_TYPE_COLORS[selectedNode.type] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {selectedNode.type}
                    </span>
                    <h3 className="font-semibold text-primary-navy">{selectedNode.label}</h3>
                    <p className="text-xs text-muted-foreground font-mono mt-1">{selectedNode.id}</p>
                  </div>

                  <div className="border-t border-border pt-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Metadata
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(selectedNode.metadata).map(([key, val]) =>
                        val ? (
                          <div key={key} className="flex items-start justify-between gap-2">
                            <span className="text-xs text-muted-foreground capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                            <span className="text-xs font-medium text-primary-navy text-right">
                              {String(val)}
                            </span>
                          </div>
                        ) : null,
                      )}
                    </div>
                  </div>

                  {nodeDetail && (
                    <div className="border-t border-border pt-4 mt-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        Full Details
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(nodeDetail)
                          .filter(
                            ([k]) =>
                              !['id', 'createdAt', 'updatedAt', 'deletedAt'].includes(k),
                          )
                          .slice(0, 8)
                          .map(([key, val]) =>
                            val !== null && val !== undefined ? (
                              <div key={key} className="flex items-start justify-between gap-2">
                                <span className="text-xs text-muted-foreground capitalize shrink-0">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}
                                </span>
                                <span className="text-xs font-medium text-primary-navy text-right truncate max-w-[160px]">
                                  {typeof val === 'object' ? JSON.stringify(val).slice(0, 40) : String(val)}
                                </span>
                              </div>
                            ) : null,
                          )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <p className="text-sm text-muted-foreground">
                    Click a node to view details
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
            Click "Build Graph" to load the knowledge graph.
          </div>
        )}
      </div>
    </main>
  );
}
