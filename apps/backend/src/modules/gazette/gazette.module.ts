import { Module } from '@nestjs/common';
import { GazetteService } from './gazette.service';
import { GazetteController } from './gazette.controller';

@Module({
  controllers: [GazetteController],
  providers: [GazetteService],
  exports: [GazetteService],
})
export class GazetteModule {}
