import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { MeetingStatus } from '@prisma/client';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { AddAgendaItemDto } from './dto/add-agenda-item.dto';
import { SetMinutesDto } from './dto/set-minutes.dto';
import { AddDecisionDto } from './dto/add-decision.dto';
import { AddActionItemDto } from './dto/add-action-item.dto';
import { UpdateActionItemDto } from './dto/update-action-item.dto';
import { IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

class AddAttendeeDto {
  @ApiProperty()
  @IsUUID()
  userId: string;
}

class MarkAttendanceDto {
  @ApiProperty()
  @IsBoolean()
  attended: boolean;
}

@ApiTags('Meetings')
@ApiBearerAuth()
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  // ─── Core CRUD ────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a meeting' })
  create(
    @Body() dto: CreateMeetingDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.meetingsService.create(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List meetings with optional filters' })
  @ApiQuery({ name: 'committeeId', required: false })
  @ApiQuery({ name: 'status', enum: MeetingStatus, required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  findAll(
    @Query('committeeId') committeeId?: string,
    @Query('status') status?: MeetingStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.meetingsService.findAll({ committeeId, status, startDate, endDate });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get meeting detail with agenda, minutes, decisions, action items, attendees' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.meetingsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update meeting details' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMeetingDto,
  ) {
    return this.meetingsService.update(id, dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a meeting' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.meetingsService.cancel(id);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark meeting as completed' })
  complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.meetingsService.complete(id);
  }

  // ─── Agenda Items ─────────────────────────────────────────────────────────

  @Post(':id/agenda')
  @ApiOperation({ summary: 'Add an agenda item to a meeting' })
  addAgendaItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddAgendaItemDto,
  ) {
    return this.meetingsService.addAgendaItem(id, dto);
  }

  @Delete(':id/agenda/:itemId')
  @ApiOperation({ summary: 'Remove an agenda item from a meeting' })
  removeAgendaItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.meetingsService.removeAgendaItem(id, itemId);
  }

  // ─── Minutes ──────────────────────────────────────────────────────────────

  @Post(':id/minutes')
  @ApiOperation({ summary: 'Create or update meeting minutes' })
  setMinutes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetMinutesDto,
  ) {
    return this.meetingsService.setMinutes(id, dto);
  }

  // ─── Decisions ────────────────────────────────────────────────────────────

  @Post(':id/decisions')
  @ApiOperation({ summary: 'Add a decision record to a meeting' })
  addDecision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddDecisionDto,
  ) {
    return this.meetingsService.addDecision(id, dto);
  }

  // ─── Action Items ─────────────────────────────────────────────────────────

  @Post(':id/action-items')
  @ApiOperation({ summary: 'Add an action item to a meeting' })
  addActionItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddActionItemDto,
  ) {
    return this.meetingsService.addActionItem(id, dto);
  }

  @Patch(':id/action-items/:itemId')
  @ApiOperation({ summary: 'Update an action item (status, assignee, due date)' })
  updateActionItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateActionItemDto,
  ) {
    return this.meetingsService.updateActionItem(id, itemId, dto);
  }

  // ─── Attendees ────────────────────────────────────────────────────────────

  @Post(':id/attendees')
  @ApiOperation({ summary: 'Add a user as attendee to a meeting' })
  addAttendee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddAttendeeDto,
  ) {
    return this.meetingsService.addAttendee(id, dto.userId);
  }

  @Patch(':id/attendees/:userId/attendance')
  @ApiOperation({ summary: 'Mark whether a user attended the meeting' })
  markAttendance(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.meetingsService.markAttendance(id, userId, dto.attended);
  }
}
