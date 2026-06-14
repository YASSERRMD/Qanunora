import { Module } from '@nestjs/common';
import { RegulatoryMappingService } from './regulatory-mapping.service';
import { RegulatoryMappingController } from './regulatory-mapping.controller';

@Module({
  controllers: [RegulatoryMappingController],
  providers: [RegulatoryMappingService],
  exports: [RegulatoryMappingService],
})
export class RegulatoryMappingModule {}
