import { Logger } from '@nestjs/common';
import { IRegistryAdapter, SyncResult, PushResult } from './registry-adapter.interface';

export class PersonnelRegistryAdapter implements IRegistryAdapter {
  private readonly logger = new Logger(PersonnelRegistryAdapter.name);

  async sync(): Promise<SyncResult> {
    this.logger.log('Syncing personnel registry...');
    const records = [
      { personnelId: 'P-001', name: 'Ahmed Al Rashidi', role: 'LEGISLATIVE_ADMIN', department: 'Legislation Dept', status: 'ACTIVE' },
      { personnelId: 'P-002', name: 'Sara Al Mansoori', role: 'MINISTRY_LEGAL_OFFICER', department: 'Legal Affairs', status: 'ACTIVE' },
      { personnelId: 'P-003', name: 'Khalid Hassan', role: 'DRAFTING_OFFICER', department: 'Drafting Unit', status: 'ACTIVE' },
      { personnelId: 'P-004', name: 'Fatima Al Zaabi', role: 'REVIEWER', department: 'Review Committee', status: 'ACTIVE' },
      { personnelId: 'P-005', name: 'Omar Bin Saud', role: 'AUDITOR', department: 'Internal Audit', status: 'ACTIVE' },
    ];
    return { records, errors: [] };
  }

  async push(data: Record<string, unknown>): Promise<PushResult> {
    this.logger.log(`Updating personnel record: ${JSON.stringify(data)}`);
    return { success: true, ref: `PERSONNEL-${Date.now()}` };
  }
}
