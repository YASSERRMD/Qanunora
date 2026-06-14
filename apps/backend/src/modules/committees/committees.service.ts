import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  CreateCommitteeDto,
  UpdateCommitteeDto,
  AddMemberDto,
  CreateReviewDto,
} from './dto/committee.dto';

@Injectable()
export class CommitteesService {
  constructor(private readonly prisma: PrismaService) {}

  async createCommittee(dto: CreateCommitteeDto) {
    return this.prisma.committee.create({
      data: {
        name: dto.name,
        nameAr: dto.nameAr,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
      include: {
        _count: { select: { members: true, reviews: true } },
      },
    });
  }

  async findAll() {
    return this.prisma.committee.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { members: true, reviews: true } },
        members: {
          where: { leftAt: null },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });
  }

  async findById(id: string) {
    const committee = await this.prisma.committee.findUnique({
      where: { id },
      include: {
        members: {
          where: { leftAt: null },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: { select: { members: true, reviews: true } },
      },
    });
    if (!committee) throw new NotFoundException(`Committee ${id} not found`);
    return committee;
  }

  async update(id: string, dto: UpdateCommitteeDto) {
    await this.findById(id);
    return this.prisma.committee.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { _count: { select: { members: true, reviews: true } } },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.committee.delete({ where: { id } });
  }

  async addMember(committeeId: string, dto: AddMemberDto) {
    await this.findById(committeeId);
    const existing = await this.prisma.committeeMember.findUnique({
      where: { committeeId_userId: { committeeId, userId: dto.userId } },
    });
    if (existing && !existing.leftAt) {
      throw new ConflictException('User is already a member of this committee');
    }
    if (existing && existing.leftAt) {
      return this.prisma.committeeMember.update({
        where: { id: existing.id },
        data: { leftAt: null, role: dto.role ?? 'MEMBER' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
    }
    return this.prisma.committeeMember.create({
      data: {
        committeeId,
        userId: dto.userId,
        role: dto.role ?? 'MEMBER',
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async removeMember(committeeId: string, userId: string) {
    await this.findById(committeeId);
    const member = await this.prisma.committeeMember.findUnique({
      where: { committeeId_userId: { committeeId, userId } },
    });
    if (!member || member.leftAt) {
      throw new NotFoundException('Member not found in this committee');
    }
    return this.prisma.committeeMember.update({
      where: { id: member.id },
      data: { leftAt: new Date() },
    });
  }

  async createReview(committeeId: string, dto: CreateReviewDto) {
    await this.findById(committeeId);
    return this.prisma.committeeReview.create({
      data: {
        committeeId,
        legislativeItemId: dto.legislativeItemId,
        recommendation: dto.recommendation,
        notes: dto.notes,
        reviewedAt: new Date(),
      },
      include: {
        committee: { select: { id: true, name: true } },
      },
    });
  }

  async findReviewsByItem(legislativeItemId: string) {
    return this.prisma.committeeReview.findMany({
      where: { legislativeItemId },
      include: {
        committee: { select: { id: true, name: true, nameAr: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
