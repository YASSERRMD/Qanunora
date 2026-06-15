export interface SyncResult {
  records: Record<string, unknown>[];
  errors: string[];
}

export interface PushResult {
  success: boolean;
  ref: string;
}

export interface IRegistryAdapter {
  sync(): Promise<SyncResult>;
  push(data: Record<string, unknown>): Promise<PushResult>;
}
