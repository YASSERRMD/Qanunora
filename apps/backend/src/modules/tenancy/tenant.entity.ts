export interface TenantEntity {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
