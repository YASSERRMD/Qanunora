import { Logger } from '@nestjs/common';
import { IRegistryAdapter, SyncResult, PushResult } from './registry-adapter.interface';

export class EntityRegistryAdapter implements IRegistryAdapter {
  private readonly logger = new Logger(EntityRegistryAdapter.name);

  async sync(): Promise<SyncResult> {
    this.logger.log('Syncing entity registry...');
    const records = [
      { entityId: 'GOV-001', name: 'Ministry of Justice', type: 'MINISTRY', status: 'ACTIVE' },
      { entityId: 'GOV-002', name: 'Ministry of Interior', type: 'MINISTRY', status: 'ACTIVE' },
      { entityId: 'GOV-003', name: 'Supreme Legislation Committee', type: 'COMMITTEE', status: 'ACTIVE' },
      { entityId: 'GOV-004', name: 'Federal National Council', type: 'LEGISLATIVE_BODY', status: 'ACTIVE' },
      { entityId: 'GOV-005', name: 'Ministry of Finance', type: 'MINISTRY', status: 'ACTIVE' },
    ];
    return { records, errors: [] };
  }

  async push(data: Record<string, unknown>): Promise<PushResult> {
    this.logger.log(`Pushing entity data: ${JSON.stringify(data)}`);
    return { success: true, ref: `ENTITY-${Date.now()}` };
  }
}
