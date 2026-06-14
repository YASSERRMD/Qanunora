export type DependencyType =
  | 'AMENDS'
  | 'REPLACES'
  | 'SUPPLEMENTS'
  | 'CONFLICTS_WITH'
  | 'REFERENCES'
  | 'DEPENDENT_ON';

export interface DetectedLaw {
  name: string;
  referenceNumber?: string;
  jurisdiction?: string;
  dependencyType: DependencyType;
  isConflicting: boolean;
  description?: string;
}

export interface RegulationDetectionResult {
  affectedLaws: DetectedLaw[];
}

export interface DependencyNode {
  id: string;
  label: string;
  type: 'ITEM' | 'REFERENCE';
}

export interface DependencyEdge {
  from: string;
  to: string;
  label: string;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}
