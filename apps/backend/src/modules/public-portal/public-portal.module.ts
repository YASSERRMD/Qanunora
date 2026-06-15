import { Module } from '@nestjs/common';
import { PublicPortalService } from './public-portal.service';
import { PublicPortalController } from './public-portal.controller';

@Module({
  controllers: [PublicPortalController],
  providers: [PublicPortalService],
  exports: [PublicPortalService],
})
export class PublicPortalModule {}
