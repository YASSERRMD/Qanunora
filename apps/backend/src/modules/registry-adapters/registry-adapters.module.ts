import { Module } from '@nestjs/common';
import { RegistryAdaptersService } from './registry-adapters.service';
import { RegistryAdaptersController } from './registry-adapters.controller';

@Module({
  controllers: [RegistryAdaptersController],
  providers: [RegistryAdaptersService],
  exports: [RegistryAdaptersService],
})
export class RegistryAdaptersModule {}
