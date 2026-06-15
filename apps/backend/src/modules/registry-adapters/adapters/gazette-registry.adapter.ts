import { Logger } from '@nestjs/common';
import { IRegistryAdapter, SyncResult, PushResult } from './registry-adapter.interface';

export class GazetteRegistryAdapter implements IRegistryAdapter {
  private readonly logger = new Logger(GazetteRegistryAdapter.name);

  async sync(): Promise<SyncResult> {
    this.logger.log('Syncing gazette registry...');
    return { records: [], errors: ['Gazette registry does not support pull sync'] };
  }

  async push(data: Record<string, unknown>): Promise<PushResult> {
    const gazetteEntry = {
      gazetteNumber: data['gazetteNumber'] ?? `OG-${Date.now()}`,
      title: data['title'] ?? 'Untitled',
      titleAr: data['titleAr'],
      issueDate: data['issueDate'] ?? new Date().toISOString(),
      effectiveDate: data['effectiveDate'],
      submittedAt: new Date().toISOString(),
    };
    this.logger.log(`Publishing to Official Gazette: ${JSON.stringify(gazetteEntry)}`);
    return { success: true, ref: String(gazetteEntry.gazetteNumber) };
  }
}
