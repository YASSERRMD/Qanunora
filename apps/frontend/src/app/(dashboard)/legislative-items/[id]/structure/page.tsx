'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

const TYPE_COLORS: Record<string, string> = {
  CHAPTER: 'bg-primary-navy text-white',
  SECTION: 'bg-slate-navy text-white',
  ARTICLE: 'bg-primary-gold/20 text-primary-navy',
  CLAUSE: 'bg-muted/40 text-muted-foreground',
};

const TYPE_INDENT: Record<string, string> = {
  CHAPTER: 'ml-0',
  SECTION: 'ml-4',
  ARTICLE: 'ml-8',
  CLAUSE: 'ml-12',
};

interface StructureNode {
  id: string;
  type: string;
  number: string;
  title?: string;
  content?: string;
  order: number;
  parentId?: string;
  children: StructureNode[];
}

function StructureNodeRow({
  node,
  depth = 0,
  onSelect,
  selectedId,
}: {
  node: StructureNode;
  depth?: number;
  onSelect: (node: StructureNode) => void;
  selectedId?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors ${
          selectedId === node.id ? 'bg-muted/30 border-l-2 border-primary-gold' : ''
        }`}
        style={{ paddingLeft: `${16 + depth * 20}px` }}
      >
        <button
          onClick={() => setExpanded((e) => !e)}
          className={`text-xs text-muted-foreground w-4 shrink-0 mt-0.5 ${!hasChildren ? 'invisible' : ''}`}
        >
          {expanded ? '▼' : '▶'}
        </button>
        <div className="flex-1 min-w-0" onClick={() => onSelect(node)}>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex rounded px-1.5 py-0.5 text-xs font-semibold ${
                TYPE_COLORS[node.type] ?? 'bg-gray-100 text-gray-700'
              }`}
            >
              {node.type}
            </span>
            <span className="text-xs font-mono text-muted-foreground">{node.number}</span>
            {node.title && (
              <span className="text-sm font-medium text-primary-navy truncate">{node.title}</span>
            )}
          </div>
        </div>
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <StructureNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LegalStructurePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [selected, setSelected] = useState<StructureNode | null>(null);

  const { data: tree, isLoading } = useQuery({
    queryKey: ['legal-structure', id],
    queryFn: async () => {
      const res = await apiClient.get<StructureNode[]>(`/legislative-items/${id}/structure`);
      return res.data;
    },
  });

  const countNodes = (nodes: StructureNode[]): number =>
    nodes.reduce((acc, n) => acc + 1 + countNodes(n.children), 0);

  return (
    <main className="flex-1 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-muted-foreground hover:text-primary-navy"
          >
            Back
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-primary-navy">Legal Structure</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Browse the chapter, section, article and clause hierarchy
            </p>
          </div>
          {tree && (
            <span className="text-xs text-muted-foreground">
              {countNodes(tree)} elements
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20 flex gap-2">
              {['CHAPTER', 'SECTION', 'ARTICLE', 'CLAUSE'].map((t) => (
                <span
                  key={t}
                  className={`inline-flex rounded px-1.5 py-0.5 text-xs font-semibold ${
                    TYPE_COLORS[t] ?? ''
                  }`}
                >
                  {t}
                </span>
              ))}
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading structure...</div>
            ) : !tree?.length ? (
              <div className="p-8 text-center text-muted-foreground">
                No legal structure defined yet
              </div>
            ) : (
              <div className="divide-y divide-border">
                {tree.map((node) => (
                  <StructureNodeRow
                    key={node.id}
                    node={node}
                    onSelect={setSelected}
                    selectedId={selected?.id}
                  />
                ))}
              </div>
            )}
          </div>

          {selected ? (
            <div className="rounded-xl border border-border bg-white shadow-sm p-5">
              <div className="flex items-center gap-3 mb-5">
                <span
                  className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${
                    TYPE_COLORS[selected.type] ?? 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {selected.type}
                </span>
                <span className="font-mono text-sm text-muted-foreground">{selected.number}</span>
              </div>

              {selected.title && (
                <h2 className="text-lg font-semibold text-primary-navy mb-4">{selected.title}</h2>
              )}

              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Type
                  </dt>
                  <dd className="text-primary-navy">{selected.type}</dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Number
                  </dt>
                  <dd className="font-mono text-primary-navy">{selected.number}</dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Order
                  </dt>
                  <dd className="text-primary-navy">{selected.order}</dd>
                </div>

                {selected.content && (
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Content
                    </dt>
                    <dd className="text-muted-foreground leading-relaxed bg-muted/20 rounded-lg p-4 text-sm whitespace-pre-wrap">
                      {selected.content}
                    </dd>
                  </div>
                )}

                {selected.children.length > 0 && (
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Child Elements ({selected.children.length})
                    </dt>
                    <dd className="space-y-1">
                      {selected.children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => setSelected(child)}
                          className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors"
                        >
                          <span
                            className={`inline-flex rounded px-1.5 py-0.5 text-xs font-semibold ${
                              TYPE_COLORS[child.type] ?? ''
                            }`}
                          >
                            {child.type}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">{child.number}</span>
                          {child.title && (
                            <span className="text-sm text-primary-navy truncate">{child.title}</span>
                          )}
                        </button>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/10 flex items-center justify-center min-h-[200px]">
              <p className="text-sm text-muted-foreground">Select a structural element to view details</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
