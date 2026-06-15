import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SessionStatus, SessionType } from '@prisma/client';
import { CreateSessionDto } from './dto/create-session.dto';
import { AddReadingStageDto } from './dto/add-reading-stage.dto';
import { AddDebateDto } from './dto/add-debate.dto';

const SESSION_INCLUDE = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  readingStages: {
    orderBy: { stageNumber: 'asc' as const },
    include: {
      legislativeItem: { select: { id: true, referenceNumber: true, title: true } },
    },
  },
  debates: { orderBy: { debateDate: 'asc' as const } },
} as const;

export interface FindAllSessionsOptions {
  status?: SessionStatus;
  sessionType?: SessionType;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ParliamentarySessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSessionDto, userId: string) {
    return this.prisma.parliamentarySession.create({
      data: {
        sessionNumber: dto.sessionNumber,
        title: dto.title,
        sessionType: dto.sessionType,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        notes: dto.notes,
        createdById: userId,
      },
      include: SESSION_INCLUDE,
    });
  }

  async findAll(opts: FindAllSessionsOptions = {}) {
    const { status, sessionType, startDate, endDate, page = 1, limit = 20 } = opts;
    const skip = (page - 1) * limit;

    const where = {
      ...(status && { status }),
      ...(sessionType && { sessionType }),
      ...(startDate || endDate
        ? {
            startDate: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.parliamentarySession.findMany({
        where,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { readingStages: true, debates: true } },
        },
        orderBy: { startDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.parliamentarySession.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findById(id: string) {
    const session = await this.prisma.parliamentarySession.findUnique({
      where: { id },
      include: SESSION_INCLUDE,
    });
    if (!session) throw new NotFoundException(`Parliamentary session ${id} not found`);
    return session;
  }

  async update(id: string, dto: Partial<CreateSessionDto>) {
    await this.findById(id);
    return this.prisma.parliamentarySession.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
      },
      include: SESSION_INCLUDE,
    });
  }

  async activate(id: string) {
    const session = await this.findById(id);
    if (session.status !== SessionStatus.UPCOMING) {
      throw new BadRequestException(`Session must be UPCOMING to activate`);
    }
    return this.prisma.parliamentarySession.update({
      where: { id },
      data: { status: SessionStatus.ACTIVE },
      include: SESSION_INCLUDE,
    });
  }

  async complete(id: string) {
    const session = await this.findById(id);
    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException(`Session must be ACTIVE to complete`);
    }
    return this.prisma.parliamentarySession.update({
      where: { id },
      data: { status: SessionStatus.COMPLETED },
      include: SESSION_INCLUDE,
    });
  }

  async cancel(id: string) {
    const session = await this.findById(id);
    if (session.status === SessionStatus.COMPLETED || session.status === SessionStatus.CANCELLED) {
      throw new BadRequestException(`Session cannot be cancelled in its current state`);
    }
    return this.prisma.parliamentarySession.update({
      where: { id },
      data: { status: SessionStatus.CANCELLED },
      include: SESSION_INCLUDE,
    });
  }

  async addReadingStage(sessionId: string, dto: AddReadingStageDto) {
    await this.findById(sessionId);
    return this.prisma.readingStage.create({
      data: {
        sessionId,
        legislativeItemId: dto.legislativeItemId,
        stageNumber: dto.stageNumber,
        stageName: dto.stageName,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
      },
      include: {
        legislativeItem: { select: { id: true, referenceNumber: true, title: true } },
      },
    });
  }

  async completeReadingStage(sessionId: string, stageId: string, outcome: string) {
    await this.findById(sessionId);
    const stage = await this.prisma.readingStage.findFirst({
      where: { id: stageId, sessionId },
    });
    if (!stage) throw new NotFoundException(`Reading stage ${stageId} not found`);

    return this.prisma.readingStage.update({
      where: { id: stageId },
      data: {
        completedDate: new Date(),
        outcome,
      },
      include: {
        legislativeItem: { select: { id: true, referenceNumber: true, title: true } },
      },
    });
  }

  async addDebate(sessionId: string, dto: AddDebateDto) {
    await this.findById(sessionId);
    return this.prisma.debate.create({
      data: {
        sessionId,
        topic: dto.topic,
        summary: dto.summary,
        speakerName: dto.speakerName,
        position: dto.position,
        debateDate: new Date(dto.debateDate),
      },
    });
  }

  async getSessionSummary(id: string) {
    const session = await this.prisma.parliamentarySession.findUnique({
      where: { id },
      include: {
        ...SESSION_INCLUDE,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!session) throw new NotFoundException(`Parliamentary session ${id} not found`);

    const completedStages = session.readingStages.filter((s) => s.completedDate);
    const pendingStages = session.readingStages.filter((s) => !s.completedDate);

    return {
      id: session.id,
      sessionNumber: session.sessionNumber,
      title: session.title,
      sessionType: session.sessionType,
      status: session.status,
      startDate: session.startDate,
      endDate: session.endDate,
      createdBy: session.createdBy,
      summary: {
        totalReadingStages: session.readingStages.length,
        completedReadingStages: completedStages.length,
        pendingReadingStages: pendingStages.length,
        totalDebates: session.debates.length,
      },
      readingStages: session.readingStages,
      debates: session.debates,
      notes: session.notes,
    };
  }
}
