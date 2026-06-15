import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { RedliningService } from '../redlining.service';
import { PrismaService } from '../../database/prisma.service';
import { RedlineStatus, RedlineType } from '@prisma/client';

const mockItem = { id: 'item-1', title: 'Test Bill', referenceNumber: 'REF-001' };

const mockChange = {
  id: 'change-1',
  legislativeItemId: 'item-1',
  proposedById: 'user-1',
  proposedBy: { id: 'user-1', firstName: 'Ahmad', lastName: 'Al-Rashid' },
  reviewedBy: null,
  originalText: 'The law shall apply to all citizens.',
  proposedText: 'The law shall apply to all residents.',
  changeType: RedlineType.MODIFICATION,
  articleRef: 'Article 2',
  rationale: 'More inclusive language',
  status: RedlineStatus.PENDING,
  reviewedById: null,
  reviewedAt: null,
  reviewNote: null,
  mentions: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  legislativeItem: { findUnique: jest.fn() },
  redlineChange: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  documentEdit: { create: jest.fn() },
  notification: { create: jest.fn().mockResolvedValue({}) },
};

describe('RedliningService', () => {
  let service: RedliningService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedliningService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RedliningService>(RedliningService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('proposeChange', () => {
    it('creates a redline proposal', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.redlineChange.create.mockResolvedValue(mockChange);

      const result = await service.proposeChange(
        'item-1',
        {
          originalText: 'The law shall apply to all citizens.',
          proposedText: 'The law shall apply to all residents.',
          articleRef: 'Article 2',
          rationale: 'More inclusive language',
        },
        'user-1',
      );

      expect(result).toEqual(mockChange);
      expect(mockPrisma.redlineChange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            legislativeItemId: 'item-1',
            proposedById: 'user-1',
          }),
        }),
      );
    });

    it('notifies mentioned users', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.redlineChange.create.mockResolvedValue({ ...mockChange, mentions: ['user-2'] });

      await service.proposeChange(
        'item-1',
        {
          originalText: 'text',
          proposedText: 'new text',
          mentions: ['user-2'],
        },
        'user-1',
      );

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-2',
            title: expect.stringContaining('mentioned'),
          }),
        }),
      );
    });

    it('throws NotFoundException for invalid legislative item', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(null);
      await expect(
        service.proposeChange('bad-id', { originalText: 'a', proposedText: 'b' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('acceptChange', () => {
    it('sets status to ACCEPTED and creates a document edit', async () => {
      mockPrisma.redlineChange.findUnique.mockResolvedValue(mockChange);
      mockPrisma.redlineChange.update.mockResolvedValue({ ...mockChange, status: RedlineStatus.ACCEPTED });
      mockPrisma.documentEdit.create.mockResolvedValue({});

      await service.acceptChange('change-1', 'reviewer-1', { note: 'Good change' });

      expect(mockPrisma.redlineChange.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: RedlineStatus.ACCEPTED }),
        }),
      );
      expect(mockPrisma.documentEdit.create).toHaveBeenCalled();
    });

    it('throws BadRequestException when change is not PENDING', async () => {
      mockPrisma.redlineChange.findUnique.mockResolvedValue({
        ...mockChange,
        status: RedlineStatus.ACCEPTED,
      });
      await expect(service.acceptChange('change-1', 'reviewer-1', {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectChange', () => {
    it('sets status to REJECTED', async () => {
      mockPrisma.redlineChange.findUnique.mockResolvedValue(mockChange);
      mockPrisma.redlineChange.update.mockResolvedValue({ ...mockChange, status: RedlineStatus.REJECTED });

      await service.rejectChange('change-1', 'reviewer-1', { note: 'Not needed' });

      expect(mockPrisma.redlineChange.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: RedlineStatus.REJECTED }),
        }),
      );
    });
  });

  describe('withdrawChange', () => {
    it('sets status to WITHDRAWN for the proposer', async () => {
      mockPrisma.redlineChange.findUnique.mockResolvedValue(mockChange);
      mockPrisma.redlineChange.update.mockResolvedValue({ ...mockChange, status: RedlineStatus.WITHDRAWN });

      await service.withdrawChange('change-1', 'user-1');

      expect(mockPrisma.redlineChange.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: RedlineStatus.WITHDRAWN },
        }),
      );
    });

    it('throws ForbiddenException for non-proposer', async () => {
      mockPrisma.redlineChange.findUnique.mockResolvedValue(mockChange);
      await expect(service.withdrawChange('change-1', 'user-2')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getRedlineStats', () => {
    it('returns counts by status and type', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.redlineChange.findMany.mockResolvedValue([
        { status: RedlineStatus.PENDING, changeType: RedlineType.MODIFICATION },
        { status: RedlineStatus.ACCEPTED, changeType: RedlineType.INSERTION },
        { status: RedlineStatus.PENDING, changeType: RedlineType.DELETION },
      ]);

      const result = await service.getRedlineStats('item-1');

      expect(result.total).toBe(3);
      expect(result.byStatus[RedlineStatus.PENDING]).toBe(2);
      expect(result.byStatus[RedlineStatus.ACCEPTED]).toBe(1);
    });
  });

  describe('applyAllAccepted', () => {
    it('creates a combined document edit for all accepted changes', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.redlineChange.findMany.mockResolvedValue([
        { ...mockChange, status: RedlineStatus.ACCEPTED, proposedText: 'Text A' },
        { ...mockChange, id: 'c2', status: RedlineStatus.ACCEPTED, proposedText: 'Text B' },
      ]);
      mockPrisma.documentEdit.create.mockResolvedValue({});

      const result = await service.applyAllAccepted('item-1', 'user-1');
      expect(result.applied).toBe(2);
      expect(mockPrisma.documentEdit.create).toHaveBeenCalled();
    });

    it('returns zero when no accepted changes exist', async () => {
      mockPrisma.legislativeItem.findUnique.mockResolvedValue(mockItem);
      mockPrisma.redlineChange.findMany.mockResolvedValue([]);

      const result = await service.applyAllAccepted('item-1', 'user-1');
      expect(result.applied).toBe(0);
    });
  });
});
