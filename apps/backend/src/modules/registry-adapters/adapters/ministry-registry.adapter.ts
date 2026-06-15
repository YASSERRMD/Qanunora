import { Logger } from '@nestjs/common';
import { IRegistryAdapter, SyncResult, PushResult } from './registry-adapter.interface';

export class MinistryRegistryAdapter implements IRegistryAdapter {
  private readonly logger = new Logger(MinistryRegistryAdapter.name);

  async sync(): Promise<SyncResult> {
    this.logger.log('Syncing ministry registry...');
    const records = [
      { ministryId: 'MOJ', name: 'Ministry of Justice', nameAr: 'وزارة العدل', headOfficer: 'H.E. Minister of Justice' },
      { ministryId: 'MOI', name: 'Ministry of Interior', nameAr: 'وزارة الداخلية', headOfficer: 'H.E. Minister of Interior' },
      { ministryId: 'MOF', name: 'Ministry of Finance', nameAr: 'وزارة المالية', headOfficer: 'H.E. Minister of Finance' },
    ];
    return { records, errors: [] };
  }

  async push(data: Record<string, unknown>): Promise<PushResult> {
    this.logger.log(`Pushing ministry data: ${JSON.stringify(data)}`);
    return { success: true, ref: `MINISTRY-${Date.now()}` };
  }
}
