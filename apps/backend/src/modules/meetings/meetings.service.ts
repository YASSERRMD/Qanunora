import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { MeetingStatus } from '@prisma/client';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { AddAgendaItemDto } from './dto/add-agenda-item.dto';
import { SetMinutesDto } from './dto/set-minutes.dto';
import { AddDecisionDto } from './dto/add-decision.dto';
import { AddActionItemDto } from './dto/add-action-item.dto';
import { UpdateActionItemDto } from './dto/update-action-item.dto';

const MEETING_INCLUDE = {
  committee: { select: { id: true, name: true } },
  agendaItems: { orderBy: { order: 'asc' as const } },
  minutes: true,
  decisions: true,
  actionItems: true,
  attendees: {
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

export interface FindAllMeetingsOptions {
  committeeId?: string;
  status?: MeetingStatus;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Core CRUD
  // -------------------------------------------------------------------------

  async create(dto: CreateMeetingDto, createdById: string) {
    return this.prisma.meeting.create({
      data: {
        title: dto.title,
        description: dto.description,
        meetingDate: new Date(dto.meetingDate),
        location: dto.location,
        committeeId: dto.committeeId,
        createdById,
      },
      include: MEETING_INCLUDE,
    });
  }

  async findAll(opts: FindAllMeetingsOptions = {}) {
    return this.prisma.meeting.findMany({
      where: {
        ...(opts.committeeId && { committeeId: opts.committeeId }),
        ...(opts.status && { status: opts.status }),
        ...(opts.startDate && { meetingDate: { gte: new Date(opts.startDate) } }),
        ...(opts.endDate && { meetingDate: { lte: new Date(opts.endDate) } }),
      },
      include: {
        committee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: {
          select: { agendaItems: true, attendees: true, actionItems: true },
        },
      },
      orderBy: { meetingDate: 'desc' },
    });
  }

  async findById(id: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
      include: MEETING_INCLUDE,
    });
    if (!meeting) throw new NotFoundException(`Meeting ${id} not found`);
    return meeting;
  }

  async update(id: string, dto: UpdateMeetingDto) {
    await this.findById(id);
    return this.prisma.meeting.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.meetingDate !== undefined && { meetingDate: new Date(dto.meetingDate) }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.committeeId !== undefined && { committeeId: dto.committeeId }),
      },
      include: MEETING_INCLUDE,
    });
  }

  async cancel(id: string) {
    await this.findById(id);
    return this.prisma.meeting.update({
      where: { id },
      data: { status: MeetingStatus.CANCELLED },
      include: MEETING_INCLUDE,
    });
  }

  async complete(id: string) {
    await this.findById(id);
    return this.prisma.meeting.update({
      where: { id },
      data: { status: MeetingStatus.COMPLETED },
      include: MEETING_INCLUDE,
    });
  }

  // -------------------------------------------------------------------------
  // Agenda Items
  // -------------------------------------------------------------------------

  async addAgendaItem(meetingId: string, dto: AddAgendaItemDto) {
    await this.findById(meetingId);
    return this.prisma.agendaItem.create({
      data: {
        meetingId,
        title: dto.title,
        description: dto.description,
        order: dto.order,
        duration: dto.duration,
        presenter: dto.presenter,
      },
    });
  }

  async removeAgendaItem(meetingId: string, itemId: string) {
    await this.findById(meetingId);
    const item = await this.prisma.agendaItem.findFirst({ where: { id: itemId, meetingId } });
    if (!item) throw new NotFoundException(`AgendaItem ${itemId} not found in meeting ${meetingId}`);
    await this.prisma.agendaItem.delete({ where: { id: itemId } });
    return { deleted: true };
  }

  // -------------------------------------------------------------------------
  // Minutes
  // -------------------------------------------------------------------------

  async setMinutes(meetingId: string, dto: SetMinutesDto) {
    await this.findById(meetingId);
    return this.prisma.meetingMinutes.upsert({
      where: { meetingId },
      create: {
        meetingId,
        content: dto.content,
        recordedBy: dto.recordedBy,
        approvedAt: dto.approvedAt ? new Date(dto.approvedAt) : undefined,
      },
      update: {
        content: dto.content,
        recordedBy: dto.recordedBy,
        approvedAt: dto.approvedAt ? new Date(dto.approvedAt) : undefined,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Decisions
  // -------------------------------------------------------------------------

  async addDecision(meetingId: string, dto: AddDecisionDto) {
    await this.findById(meetingId);
    return this.prisma.meetingDecision.create({
      data: {
        meetingId,
        description: dto.description,
        decisionRef: dto.decisionRef,
        ownerId: dto.ownerId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Action Items
  // -------------------------------------------------------------------------

  async addActionItem(meetingId: string, dto: AddActionItemDto) {
    await this.findById(meetingId);
    return this.prisma.actionItem.create({
      data: {
        meetingId,
        description: dto.description,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  async updateActionItem(meetingId: string, itemId: string, dto: UpdateActionItemDto) {
    await this.findById(meetingId);
    const item = await this.prisma.actionItem.findFirst({ where: { id: itemId, meetingId } });
    if (!item) throw new NotFoundException(`ActionItem ${itemId} not found`);
    return this.prisma.actionItem.update({
      where: { id: itemId },
      data: {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  // -------------------------------------------------------------------------
  // Attendees
  // -------------------------------------------------------------------------

  async addAttendee(meetingId: string, userId: string) {
    await this.findById(meetingId);
    const existing = await this.prisma.meetingAttendee.findUnique({
      where: { meetingId_userId: { meetingId, userId } },
    });
    if (existing) throw new BadRequestException('User is already an attendee of this meeting');
    return this.prisma.meetingAttendee.create({
      data: { meetingId, userId, attended: false },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async markAttendance(meetingId: string, userId: string, attended: boolean) {
    await this.findById(meetingId);
    return this.prisma.meetingAttendee.update({
      where: { meetingId_userId: { meetingId, userId } },
      data: { attended },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  }
}
