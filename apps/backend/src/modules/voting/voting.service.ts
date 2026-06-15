import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { VoteResult, VotePosition } from '@prisma/client';
import { CreateVoteEventDto } from './dto/create-vote-event.dto';
import { RecordMemberVoteDto } from './dto/record-member-vote.dto';
import { CreateResolutionDto } from './dto/create-resolution.dto';

const VOTE_EVENT_INCLUDE = {
  legislativeItem: { select: { id: true, referenceNumber: true, title: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  memberPositions: {
    include: {
      member: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { votedAt: 'asc' as const },
  },
  resolution: true,
} as const;

export interface FindAllVoteEventsOptions {
  result?: VoteResult;
  legislativeItemId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class VotingService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateResolutionRefNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.resolution.count({
      where: { refNumber: { startsWith: `RES-${year}-` } },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `RES-${year}-${seq}`;
  }

  private computeResult(
    totalFor: number,
    totalAgainst: number,
    totalAbstain: number,
    quorumRequired?: number | null,
  ): VoteResult {
    const totalVoted = totalFor + totalAgainst + totalAbstain;
    if (quorumRequired && totalVoted < quorumRequired) {
      return VoteResult.QUORUM_NOT_MET;
    }
    if (totalFor > totalAgainst) return VoteResult.PASSED;
    if (totalAgainst > totalFor) return VoteResult.FAILED;
    return VoteResult.TIED;
  }

  async createVoteEvent(dto: CreateVoteEventDto, userId: string) {
    return this.prisma.voteEvent.create({
      data: {
        title: dto.title,
        description: dto.description,
        voteDate: new Date(dto.voteDate),
        legislativeItemId: dto.legislativeItemId,
        sessionId: dto.sessionId,
        quorumRequired: dto.quorumRequired,
        createdById: userId,
      },
      include: VOTE_EVENT_INCLUDE,
    });
  }

  async findAll(opts: FindAllVoteEventsOptions = {}) {
    const { result, legislativeItemId, page = 1, limit = 20 } = opts;
    const skip = (page - 1) * limit;

    const where = {
      ...(result && { result }),
      ...(legislativeItemId && { legislativeItemId }),
    };

    const [items, total] = await Promise.all([
      this.prisma.voteEvent.findMany({
        where,
        include: {
          legislativeItem: { select: { id: true, referenceNumber: true, title: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { memberPositions: true } },
          resolution: { select: { id: true, refNumber: true, title: true } },
        },
        orderBy: { voteDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.voteEvent.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findById(id: string) {
    const event = await this.prisma.voteEvent.findUnique({
      where: { id },
      include: VOTE_EVENT_INCLUDE,
    });
    if (!event) throw new NotFoundException(`Vote event ${id} not found`);
    return event;
  }

  async recordMemberVote(voteEventId: string, dto: RecordMemberVoteDto) {
    const event = await this.findById(voteEventId);

    if (event.result !== VoteResult.PENDING) {
      throw new BadRequestException(`Vote is already finalized (result: ${event.result})`);
    }

    // Upsert member position
    await this.prisma.memberVotePosition.upsert({
      where: { voteEventId_memberId: { voteEventId, memberId: dto.memberId } },
      create: {
        voteEventId,
        memberId: dto.memberId,
        position: dto.position,
        note: dto.note,
      },
      update: {
        position: dto.position,
        note: dto.note,
        votedAt: new Date(),
      },
    });

    // Recalculate totals
    const [forCount, againstCount, abstainCount] = await Promise.all([
      this.prisma.memberVotePosition.count({
        where: { voteEventId, position: VotePosition.FOR },
      }),
      this.prisma.memberVotePosition.count({
        where: { voteEventId, position: VotePosition.AGAINST },
      }),
      this.prisma.memberVotePosition.count({
        where: { voteEventId, position: VotePosition.ABSTAIN },
      }),
    ]);

    return this.prisma.voteEvent.update({
      where: { id: voteEventId },
      data: {
        totalFor: forCount,
        totalAgainst: againstCount,
        totalAbstain: abstainCount,
      },
      include: VOTE_EVENT_INCLUDE,
    });
  }

  async finalizeVote(voteEventId: string) {
    const event = await this.findById(voteEventId);

    if (event.result !== VoteResult.PENDING) {
      throw new BadRequestException(`Vote is already finalized`);
    }

    const result = this.computeResult(
      event.totalFor,
      event.totalAgainst,
      event.totalAbstain,
      event.quorumRequired,
    );

    return this.prisma.voteEvent.update({
      where: { id: voteEventId },
      data: { result },
      include: VOTE_EVENT_INCLUDE,
    });
  }

  async createResolution(voteEventId: string, dto: CreateResolutionDto) {
    const event = await this.findById(voteEventId);

    if (event.result !== VoteResult.PASSED) {
      throw new BadRequestException(`Resolution can only be created for PASSED votes`);
    }

    if (event.resolution) {
      throw new BadRequestException(`A resolution already exists for this vote event`);
    }

    const refNumber = await this.generateResolutionRefNumber();

    return this.prisma.resolution.create({
      data: {
        voteEventId,
        refNumber,
        title: dto.title,
        text: dto.text,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        issuedAt: new Date(),
      },
    });
  }

  async getVoteAnalytics(voteEventId: string) {
    const event = await this.findById(voteEventId);

    const total = event.totalFor + event.totalAgainst + event.totalAbstain;

    return {
      voteEventId: event.id,
      title: event.title,
      result: event.result,
      totalVotes: total,
      breakdown: {
        for: {
          count: event.totalFor,
          percentage: total > 0 ? Math.round((event.totalFor / total) * 100) : 0,
        },
        against: {
          count: event.totalAgainst,
          percentage: total > 0 ? Math.round((event.totalAgainst / total) * 100) : 0,
        },
        abstain: {
          count: event.totalAbstain,
          percentage: total > 0 ? Math.round((event.totalAbstain / total) * 100) : 0,
        },
      },
      quorumRequired: event.quorumRequired,
      quorumMet: event.quorumRequired ? total >= event.quorumRequired : null,
      memberPositions: event.memberPositions,
    };
  }
}
