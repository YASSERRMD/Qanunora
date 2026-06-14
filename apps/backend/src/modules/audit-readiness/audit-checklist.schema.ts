export interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  required: boolean;
}

export const AUDIT_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'CL01',
    category: 'DOCUMENTATION',
    title: 'Draft law uploaded',
    description: 'At least one DRAFT category document exists',
    required: true,
  },
  {
    id: 'CL02',
    category: 'DOCUMENTATION',
    title: 'Final version exists',
    description: 'At least one FINAL category document exists',
    required: true,
  },
  {
    id: 'CL03',
    category: 'WORKFLOW',
    title: 'Workflow history recorded',
    description: 'At least one workflow transition has occurred',
    required: true,
  },
  {
    id: 'CL04',
    category: 'COMMITTEE',
    title: 'Committee review completed',
    description: 'A committee review exists with a recommendation',
    required: true,
  },
  {
    id: 'CL05',
    category: 'CONSULTATION',
    title: 'Public consultation held',
    description: 'At least one consultation reached CLOSED status',
    required: false,
  },
  {
    id: 'CL06',
    category: 'LEGAL',
    title: 'Legal review stage reached',
    description: 'Item reached LEGAL_REVIEW status at some point',
    required: true,
  },
  {
    id: 'CL07',
    category: 'APPROVAL',
    title: 'Approval recorded',
    description: 'Item has APPROVE action in workflow history',
    required: true,
  },
  {
    id: 'CL08',
    category: 'VERSION',
    title: 'Version history maintained',
    description: 'At least 2 versions exist',
    required: false,
  },
  {
    id: 'CL09',
    category: 'TRACEABILITY',
    title: 'Trace links established',
    description: 'At least one trace link exists for this item',
    required: false,
  },
  {
    id: 'CL10',
    category: 'AI_ANALYSIS',
    title: 'Impact analysis completed',
    description: 'At least one impact analysis has been run',
    required: false,
  },
];

export type AuditOverallStatus = 'READY' | 'PARTIAL' | 'NOT_READY';

export interface ChecklistEvaluationResult {
  item: ChecklistItem;
  passed: boolean;
  evidence: string;
}

export interface AuditSummary {
  legislativeItemId: string;
  totalItems: number;
  passedItems: number;
  requiredItems: number;
  passedRequired: number;
  overallStatus: AuditOverallStatus;
  checklist: ChecklistEvaluationResult[];
}
