import { Module } from '@nestjs/common';
import { ParliamentarySessionsService } from './parliamentary-sessions.service';
import { ParliamentarySessionsController } from './parliamentary-sessions.controller';

@Module({
  controllers: [ParliamentarySessionsController],
  providers: [ParliamentarySessionsService],
  exports: [ParliamentarySessionsService],
})
export class ParliamentarySessionsModule {}
