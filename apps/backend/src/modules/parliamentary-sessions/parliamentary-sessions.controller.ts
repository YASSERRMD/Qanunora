import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SessionStatus, SessionType } from '@prisma/client';
import { ParliamentarySessionsService } from './parliamentary-sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { AddReadingStageDto } from './dto/add-reading-stage.dto';
import { AddDebateDto } from './dto/add-debate.dto';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class CompleteReadingStageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  outcome: string;
}

@ApiTags('Parliamentary Sessions')
@ApiBearerAuth()
@Controller('parliamentary-sessions')
export class ParliamentarySessionsController {
  constructor(private readonly sessionsService: ParliamentarySessionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a parliamentary session' })
  create(
    @Body() dto: CreateSessionDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.sessionsService.create(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List parliamentary sessions with optional filters' })
  @ApiQuery({ name: 'status', enum: SessionStatus, required: false })
  @ApiQuery({ name: 'sessionType', enum: SessionType, required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('status') status?: SessionStatus,
    @Query('sessionType') sessionType?: SessionType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.sessionsService.findAll({
      status,
      sessionType,
      startDate,
      endDate,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get session detail with reading stages and debates' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.findById(id);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Get aggregated session summary' })
  getSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.getSessionSummary(id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a parliamentary session' })
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.activate(id);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Complete a parliamentary session' })
  complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.complete(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a parliamentary session' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.cancel(id);
  }

  // ─── Reading Stages ───────────────────────────────────────────────────────

  @Post(':id/reading-stages')
  @ApiOperation({ summary: 'Add a reading stage to a session' })
  addReadingStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddReadingStageDto,
  ) {
    return this.sessionsService.addReadingStage(id, dto);
  }

  @Patch(':id/reading-stages/:stageId/complete')
  @ApiOperation({ summary: 'Mark a reading stage as complete with an outcome' })
  completeReadingStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() dto: CompleteReadingStageDto,
  ) {
    return this.sessionsService.completeReadingStage(id, stageId, dto.outcome);
  }

  // ─── Debates ──────────────────────────────────────────────────────────────

  @Post(':id/debates')
  @ApiOperation({ summary: 'Add a debate to a session' })
  addDebate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddDebateDto,
  ) {
    return this.sessionsService.addDebate(id, dto);
  }
}
