import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CommitteesService } from '../committees.service';
import { PrismaService } from '../../database/prisma.service';

const mockCommittee = {
  id: 'comm-1',
  name: 'Legislative Review Committee',
  nameAr: null,
  description: 'Reviews draft legislation',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { members: 3, reviews: 2 },
  members: [],
  reviews: [],
};

const mockMember = {
  id: 'member-1',
  committeeId: 'comm-1',
  userId: 'user-1',
  role: 'MEMBER',
  joinedAt: new Date(),
  leftAt: null,
  user: { id: 'user-1', firstName: 'Alice', lastName: 'Smith', email: 'alice@gov.qa' },
};

const mockReview = {
  id: 'review-1',
  committeeId: 'comm-1',
  legislativeItemId: 'item-1',
  recommendation: 'APPROVE',
  notes: 'Looks good',
  reviewedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  committee: { id: 'comm-1', name: 'Legislative Review Committee' },
};

const mockPrisma = {
  committee: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  committeeMember: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  committeeReview: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('CommitteesService', () => {
  let service: CommitteesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommitteesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CommitteesService>(CommitteesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createCommittee', () => {
    it('creates a committee with defaults', async () => {
      mockPrisma.committee.create.mockResolvedValue(mockCommittee);
      const result = await service.createCommittee({ name: 'Legislative Review Committee' });
      expect(mockPrisma.committee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Legislative Review Committee', isActive: true }),
        }),
      );
      expect(result).toEqual(mockCommittee);
    });
  });

  describe('findAll', () => {
    it('returns all committees', async () => {
      mockPrisma.committee.findMany.mockResolvedValue([mockCommittee]);
      const result = await service.findAll();
      expect(result).toEqual([mockCommittee]);
    });
  });

  describe('findById', () => {
    it('returns committee when found', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      const result = await service.findById('comm-1');
      expect(result).toEqual(mockCommittee);
    });

    it('throws NotFoundException when committee does not exist', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates and returns the committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      const updated = { ...mockCommittee, name: 'Updated Committee' };
      mockPrisma.committee.update.mockResolvedValue(updated);
      const result = await service.update('comm-1', { name: 'Updated Committee' });
      expect(result.name).toBe('Updated Committee');
    });

    it('throws NotFoundException when committee does not exist', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(null);
      await expect(service.update('nonexistent', { name: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes a committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committee.delete.mockResolvedValue(mockCommittee);
      await service.delete('comm-1');
      expect(mockPrisma.committee.delete).toHaveBeenCalledWith({ where: { id: 'comm-1' } });
    });

    it('throws NotFoundException when committee does not exist', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(null);
      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addMember', () => {
    it('adds a new member to a committee', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue(null);
      mockPrisma.committeeMember.create.mockResolvedValue(mockMember);
      const result = await service.addMember('comm-1', { userId: 'user-1' });
      expect(result).toEqual(mockMember);
    });

    it('throws ConflictException when member already active', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue({ ...mockMember, leftAt: null });
      await expect(service.addMember('comm-1', { userId: 'user-1' })).rejects.toThrow(ConflictException);
    });

    it('re-activates a previously removed member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue({ ...mockMember, leftAt: new Date() });
      mockPrisma.committeeMember.update.mockResolvedValue(mockMember);
      const result = await service.addMember('comm-1', { userId: 'user-1' });
      expect(mockPrisma.committeeMember.update).toHaveBeenCalled();
      expect(result).toEqual(mockMember);
    });
  });

  describe('removeMember', () => {
    it('soft-deletes a member', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue(mockMember);
      mockPrisma.committeeMember.update.mockResolvedValue({ ...mockMember, leftAt: new Date() });
      await service.removeMember('comm-1', 'user-1');
      expect(mockPrisma.committeeMember.update).toHaveBeenCalled();
    });

    it('throws NotFoundException when member not found', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeMember.findUnique.mockResolvedValue(null);
      await expect(service.removeMember('comm-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createReview', () => {
    it('creates a review for a legislative item', async () => {
      mockPrisma.committee.findUnique.mockResolvedValue(mockCommittee);
      mockPrisma.committeeReview.create.mockResolvedValue(mockReview);
      const result = await service.createReview('comm-1', {
        legislativeItemId: 'item-1',
        recommendation: 'APPROVE',
        notes: 'Looks good',
      });
      expect(result).toEqual(mockReview);
    });
  });

  describe('findReviewsByItem', () => {
    it('returns reviews for a given legislative item', async () => {
      mockPrisma.committeeReview.findMany.mockResolvedValue([mockReview]);
      const result = await service.findReviewsByItem('item-1');
      expect(result).toEqual([mockReview]);
    });
  });
});
