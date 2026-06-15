import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventType } from '@prisma/client';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

const EVENT_INCLUDE = {
  legislativeItem: { select: { id: true, title: true, referenceNumber: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

export interface FindAllCalendarEventsOptions {
  startDate?: string;
  endDate?: string;
  eventType?: EventType;
  assignedToId?: string;
}

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCalendarEventDto, createdById: string) {
    return this.prisma.calendarEvent.create({
      data: {
        title: dto.title,
        description: dto.description,
        eventType: dto.eventType,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        allDay: dto.allDay ?? false,
        legislativeItemId: dto.legislativeItemId,
        assignedToId: dto.assignedToId,
        remindAt: dto.remindAt ? new Date(dto.remindAt) : undefined,
        createdById,
      },
      include: EVENT_INCLUDE,
    });
  }

  async findAll(opts: FindAllCalendarEventsOptions = {}) {
    return this.prisma.calendarEvent.findMany({
      where: {
        ...(opts.eventType && { eventType: opts.eventType }),
        ...(opts.assignedToId && { assignedToId: opts.assignedToId }),
        ...(opts.startDate && { startDate: { gte: new Date(opts.startDate) } }),
        ...(opts.endDate && { startDate: { lte: new Date(opts.endDate) } }),
      },
      include: EVENT_INCLUDE,
      orderBy: { startDate: 'asc' },
    });
  }

  async findById(id: string) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id },
      include: EVENT_INCLUDE,
    });
    if (!event) throw new NotFoundException(`CalendarEvent ${id} not found`);
    return event;
  }

  async update(id: string, dto: UpdateCalendarEventDto) {
    await this.findById(id);
    return this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.eventType !== undefined && { eventType: dto.eventType }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.allDay !== undefined && { allDay: dto.allDay }),
        ...(dto.assignedToId !== undefined && { assignedToId: dto.assignedToId }),
        ...(dto.remindAt !== undefined && { remindAt: new Date(dto.remindAt) }),
        ...(dto.isCompleted !== undefined && { isCompleted: dto.isCompleted }),
      },
      include: EVENT_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.calendarEvent.delete({ where: { id } });
    return { deleted: true };
  }

  async getUpcoming(days = 7) {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    return this.prisma.calendarEvent.findMany({
      where: {
        startDate: { gte: now, lte: cutoff },
        isCompleted: false,
      },
      include: EVENT_INCLUDE,
      orderBy: { startDate: 'asc' },
    });
  }

  async getOverdue() {
    return this.prisma.calendarEvent.findMany({
      where: {
        startDate: { lt: new Date() },
        isCompleted: false,
      },
      include: EVENT_INCLUDE,
      orderBy: { startDate: 'asc' },
    });
  }

  async markCompleted(id: string) {
    await this.findById(id);
    return this.prisma.calendarEvent.update({
      where: { id },
      data: { isCompleted: true },
      include: EVENT_INCLUDE,
    });
  }

  // Used by reminder integration — find events whose remindAt is in the past and not yet completed
  async getDueReminders() {
    return this.prisma.calendarEvent.findMany({
      where: {
        remindAt: { lte: new Date() },
        isCompleted: false,
      },
      include: {
        ...EVENT_INCLUDE,
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { remindAt: 'asc' },
    });
  }
}
