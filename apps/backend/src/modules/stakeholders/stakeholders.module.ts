import { Module } from '@nestjs/common';
import { StakeholdersService } from './stakeholders.service';
import { StakeholdersController } from './stakeholders.controller';

@Module({
  controllers: [StakeholdersController],
  providers: [StakeholdersService],
  exports: [StakeholdersService],
})
export class StakeholdersModule {}
