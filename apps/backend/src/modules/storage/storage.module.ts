import { Module } from '@nestjs/common';
import { LocalStorageProvider } from './providers/local.storage';
import { STORAGE_PROVIDER } from './storage.interface';

@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useClass: LocalStorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
