import { Module } from '@nestjs/common';
import { DecisionRegisterService } from './decision-register.service';
import { DecisionRegisterController } from './decision-register.controller';

@Module({
  controllers: [DecisionRegisterController],
  providers: [DecisionRegisterService],
  exports: [DecisionRegisterService],
})
export class DecisionRegisterModule {}
