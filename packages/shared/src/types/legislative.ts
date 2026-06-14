import {
  LegislativeItemType,
  LegislativeStatus,
  ConfidentialityLevel,
  Priority,
  AmendmentStatus,
} from './enums';

export interface LegislativeItem {
  id: string;
  referenceNumber: string;
  title: string;
  titleAr?: string;
  type: LegislativeItemType;
  status: LegislativeStatus;
  confidentialityLevel: ConfidentialityLevel;
  priority: Priority;
  ministryId: string;
  assignedToId?: string;
  description?: string;
  objective?: string;
  targetEnactmentDate?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface Amendment {
  id: string;
  legislativeItemId: string;
  proposedById: string;
  title: string;
  description: string;
  reason: string;
  articleReference?: string;
  sectionReference?: string;
  status: AmendmentStatus;
  impactSummary?: string;
  approvedById?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LegalStructure {
  id: string;
  legislativeItemId: string;
  type: 'CHAPTER' | 'SECTION' | 'ARTICLE' | 'CLAUSE';
  number: string;
  title?: string;
  content?: string;
  order: number;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}
