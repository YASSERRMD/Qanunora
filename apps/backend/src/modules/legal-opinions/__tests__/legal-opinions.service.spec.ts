import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LegalOpinionsService } from '../legal-opinions.service';
import { PrismaService } from '../../database/prisma.service';
import { OpinionStatus, Priority } from '@prisma/client';

const MOCK_OPINION = {
  id: 'opinion-uuid-1',
  referenceNumber: 'LO-2026-0001',
  subject: 'Legal analysis of digital commerce bill',
  requestedById: 'user-uuid-1',
  requestedBy: { id: 'user-uuid-1', firstName: 'Sara', lastName: 'Ahmed', email: 'sara@gov.ae' },
  assignedToId: null,
  assignedTo: null,
  legislativeItemId: null,
  legislativeItem: null,
  status: OpinionStatus.REQUESTED,
  priority: Priority.MEDIUM,
  dueDate: null,
  versions: [],
  references: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_VERSION = {
  id: 'version-uuid-1',
  opinionId: 'opinion-uuid-1',
  versionNumber: 1,
  content: 'Initial draft content for legal opinion',
  authorId: 'user-uuid-1',
  author: { id: 'user-uuid-1', firstName: 'Sara', lastName: 'Ahmed' },
  isApproved: false,
  approvedById: null,
  approvedAt: null,
  createdAt: new Date(),
};

function makeMockPrisma() {
  return {
    legalOpinion: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(MOCK_OPINION),
      findMany: jest.fn().mockResolvedValue([MOCK_OPINION]),
      findUnique: jest.fn().mockResolvedValue(MOCK_OPINION),
      update: jest.fn().mockResolvedValue({ ...MOCK_OPINION }),
    },
    legalOpinionVersion: {
      create: jest.fn().mockResolvedValue(MOCK_VERSION),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ ...MOCK_VERSION, isApproved: true, approvedAt: new Date() }),
    },
  };
}

describe('LegalOpinionsService', () => {
  let service: LegalOpinionsService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegalOpinionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<LegalOpinionsService>(LegalOpinionsService);
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('creates a legal opinion with auto-generated reference number', async () => {
      const result = await service.create(
        { subject: 'Test legal opinion' },
        'user-uuid-1',
      );
      expect(result).toEqual(MOCK_OPINION);
      expect(mockPrisma.legalOpinion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subject: 'Test legal opinion',
            requestedById: 'user-uuid-1',
            referenceNumber: expect.stringMatching(/^LO-\d{4}-\d{4}$/),
            status: OpinionStatus.REQUESTED,
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // findById
  // -------------------------------------------------------------------------

  describe('findById', () => {
    it('returns opinion by id', async () => {
      const result = await service.findById('opinion-uuid-1');
      expect(result).toEqual(MOCK_OPINION);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.legalOpinion.findUnique.mockResolvedValueOnce(null);
      await expect(service.findById('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // assign
  // -------------------------------------------------------------------------

  describe('assign', () => {
    it('assigns opinion to user and changes status to ASSIGNED', async () => {
      mockPrisma.legalOpinion.update.mockResolvedValueOnce({
        ...MOCK_OPINION,
        assignedToId: 'user-uuid-2',
        status: OpinionStatus.ASSIGNED,
      });
      const result = await service.assign('opinion-uuid-1', 'user-uuid-2');
      expect(result.status).toBe(OpinionStatus.ASSIGNED);
      expect(mockPrisma.legalOpinion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { assignedToId: 'user-uuid-2', status: OpinionStatus.ASSIGNED },
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // addVersion
  // -------------------------------------------------------------------------

  describe('addVersion', () => {
    it('creates version 1 when no prior versions', async () => {
      const result = await service.addVersion(
        'opinion-uuid-1',
        { content: 'Draft content' },
        'user-uuid-1',
      );
      expect(result.versionNumber).toBe(1);
      expect(result.content).toBe('Initial draft content for legal opinion');
    });

    it('increments version number based on latest', async () => {
      mockPrisma.legalOpinionVersion.findFirst.mockResolvedValueOnce({ versionNumber: 2 });
      await service.addVersion('opinion-uuid-1', { content: 'V3 content' }, 'user-uuid-1');
      expect(mockPrisma.legalOpinionVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ versionNumber: 3 }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // approveVersion
  // -------------------------------------------------------------------------

  describe('approveVersion', () => {
    it('marks version as approved and sets opinion to APPROVED', async () => {
      mockPrisma.legalOpinionVersion.findFirst.mockResolvedValueOnce(MOCK_VERSION);
      const result = await service.approveVersion('opinion-uuid-1', 'version-uuid-1', 'user-uuid-1');
      expect(result.isApproved).toBe(true);
    });

    it('throws NotFoundException when version not found', async () => {
      mockPrisma.legalOpinionVersion.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.approveVersion('opinion-uuid-1', 'ghost', 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // issue
  // -------------------------------------------------------------------------

  describe('issue', () => {
    it('issues an APPROVED opinion', async () => {
      mockPrisma.legalOpinion.findUnique.mockResolvedValueOnce({
        ...MOCK_OPINION,
        status: OpinionStatus.APPROVED,
      });
      mockPrisma.legalOpinion.update.mockResolvedValueOnce({
        ...MOCK_OPINION,
        status: OpinionStatus.ISSUED,
      });
      const result = await service.issue('opinion-uuid-1');
      expect(result.status).toBe(OpinionStatus.ISSUED);
    });

    it('throws BadRequestException when not APPROVED', async () => {
      await expect(service.issue('opinion-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // withdraw
  // -------------------------------------------------------------------------

  describe('withdraw', () => {
    it('withdraws an opinion', async () => {
      mockPrisma.legalOpinion.update.mockResolvedValueOnce({
        ...MOCK_OPINION,
        status: OpinionStatus.WITHDRAWN,
      });
      const result = await service.withdraw('opinion-uuid-1');
      expect(result.status).toBe(OpinionStatus.WITHDRAWN);
    });

    it('throws BadRequestException when already WITHDRAWN', async () => {
      mockPrisma.legalOpinion.findUnique.mockResolvedValueOnce({
        ...MOCK_OPINION,
        status: OpinionStatus.WITHDRAWN,
      });
      await expect(service.withdraw('opinion-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });
});
