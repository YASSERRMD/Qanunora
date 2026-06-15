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
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { EventType } from '@prisma/client';
import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

@ApiTags('Calendar')
@ApiBearerAuth()
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post()
  @ApiOperation({ summary: 'Create a calendar event' })
  create(@Body() dto: CreateCalendarEventDto, @Request() req: { user: { userId: string } }) {
    return this.calendarService.create(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List calendar events with optional date range and type filters' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'eventType', enum: EventType, required: false })
  @ApiQuery({ name: 'assignedToId', required: false })
  findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('eventType') eventType?: EventType,
    @Query('assignedToId') assignedToId?: string,
  ) {
    return this.calendarService.findAll({ startDate, endDate, eventType, assignedToId });
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Events due in the next N days (default 7)' })
  @ApiQuery({ name: 'days', required: false })
  getUpcoming(@Query('days') days?: string) {
    return this.calendarService.getUpcoming(days ? Number(days) : 7);
  }

  @Get('overdue')
  @ApiOperation({ summary: 'Events with startDate in the past and not completed' })
  getOverdue() {
    return this.calendarService.getOverdue();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get calendar event by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.calendarService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update calendar event' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    return this.calendarService.update(id, dto);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark calendar event as completed' })
  markCompleted(@Param('id', ParseUUIDPipe) id: string) {
    return this.calendarService.markCompleted(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete calendar event' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.calendarService.remove(id);
  }
}
