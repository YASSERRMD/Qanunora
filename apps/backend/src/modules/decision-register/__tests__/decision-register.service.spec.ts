import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DecisionRegisterService } from '../decision-register.service';
import { PrismaService } from '../../database/prisma.service';
import { DecisionStatus } from '@prisma/client';

const MOCK_DECISION = {
  id: 'decision-uuid-1',
  referenceNumber: 'DR-2026-0001',
  title: 'Approve Draft Law on Digital Commerce',
  description: 'Decision to approve the digital commerce draft law for public consultation',
  rationale: 'Aligns with digital transformation strategy',
  decisionDate: new Date('2026-06-01'),
  ownerId: 'user-uuid-1',
  owner: { id: 'user-uuid-1', firstName: 'Sara', lastName: 'Ahmed', email: 'sara@gov.ae' },
  status: DecisionStatus.ACTIVE,
  linkedItems: [],
  createdById: 'user-uuid-1',
  createdBy: { id: 'user-uuid-1', firstName: 'Sara', lastName: 'Ahmed' },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_LINK = {
  id: 'link-uuid-1',
  decisionId: 'decision-uuid-1',
  entityType: 'legislative_item',
  entityId: 'item-uuid-1',
  linkNote: 'Primary legislative item',
  createdAt: new Date(),
};

function makeMockPrisma() {
  return {
    decisionRecord: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(MOCK_DECISION),
      findMany: jest.fn().mockResolvedValue([MOCK_DECISION]),
      findUnique: jest.fn().mockResolvedValue(MOCK_DECISION),
      update: jest.fn().mockResolvedValue({ ...MOCK_DECISION }),
    },
    decisionLink: {
      create: jest.fn().mockResolvedValue(MOCK_LINK),
      findUnique: jest.fn().mockResolvedValue(MOCK_LINK),
      findMany: jest.fn().mockResolvedValue([MOCK_LINK]),
      delete: jest.fn().mockResolvedValue(MOCK_LINK),
    },
  };
}

describe('DecisionRegisterService', () => {
  let service: DecisionRegisterService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecisionRegisterService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<DecisionRegisterService>(DecisionRegisterService);
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('creates a decision record with auto-generated reference number', async () => {
      const result = await service.create(
        {
          title: 'Test Decision',
          description: 'Test description',
          decisionDate: '2026-06-01',
          ownerId: 'user-uuid-1',
        },
        'user-uuid-1',
      );
      expect(result).toEqual(MOCK_DECISION);
      expect(mockPrisma.decisionRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Test Decision',
            createdById: 'user-uuid-1',
            referenceNumber: expect.stringMatching(/^DR-\d{4}-\d{4}$/),
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // findById
  // -------------------------------------------------------------------------

  describe('findById', () => {
    it('returns decision by id', async () => {
      const result = await service.findById('decision-uuid-1');
      expect(result).toEqual(MOCK_DECISION);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.decisionRecord.findUnique.mockResolvedValueOnce(null);
      await expect(service.findById('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------

  describe('findAll', () => {
    it('returns paginated results', async () => {
      mockPrisma.decisionRecord.count = jest.fn().mockResolvedValue(1);
      const result = await service.findAll({ status: DecisionStatus.ACTIVE });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // supersede
  // -------------------------------------------------------------------------

  describe('supersede', () => {
    it('sets status to SUPERSEDED when ACTIVE', async () => {
      mockPrisma.decisionRecord.update.mockResolvedValueOnce({
        ...MOCK_DECISION,
        status: DecisionStatus.SUPERSEDED,
      });
      const result = await service.supersede('decision-uuid-1');
      expect(result.status).toBe(DecisionStatus.SUPERSEDED);
    });

    it('throws BadRequestException when not ACTIVE', async () => {
      mockPrisma.decisionRecord.findUnique.mockResolvedValueOnce({
        ...MOCK_DECISION,
        status: DecisionStatus.REVOKED,
      });
      await expect(service.supersede('decision-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // revoke
  // -------------------------------------------------------------------------

  describe('revoke', () => {
    it('sets status to REVOKED', async () => {
      mockPrisma.decisionRecord.update.mockResolvedValueOnce({
        ...MOCK_DECISION,
        status: DecisionStatus.REVOKED,
      });
      const result = await service.revoke('decision-uuid-1');
      expect(result.status).toBe(DecisionStatus.REVOKED);
    });

    it('throws BadRequestException when already REVOKED', async () => {
      mockPrisma.decisionRecord.findUnique.mockResolvedValueOnce({
        ...MOCK_DECISION,
        status: DecisionStatus.REVOKED,
      });
      await expect(service.revoke('decision-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // Links
  // -------------------------------------------------------------------------

  describe('addLink', () => {
    it('creates a decision link', async () => {
      const result = await service.addLink('decision-uuid-1', {
        entityType: 'legislative_item',
        entityId: 'item-uuid-1',
        linkNote: 'Primary item',
      });
      expect(result).toEqual(MOCK_LINK);
    });
  });

  describe('removeLink', () => {
    it('deletes link and returns deleted: true', async () => {
      const result = await service.removeLink('link-uuid-1');
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when link not found', async () => {
      mockPrisma.decisionLink.findUnique.mockResolvedValueOnce(null);
      await expect(service.removeLink('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getLinks', () => {
    it('returns links for a decision', async () => {
      const result = await service.getLinks('decision-uuid-1');
      expect(result).toHaveLength(1);
    });
  });
});
