import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StakeholdersService } from '../stakeholders.service';
import { PrismaService } from '../../database/prisma.service';
import { StakeholderType } from '@prisma/client';

const mockStakeholder = {
  id: 'stakeholder-1',
  name: 'Qatar Chamber of Commerce',
  nameAr: null,
  type: StakeholderType.PRIVATE_SECTOR,
  contactEmail: 'contact@qatarchamber.com',
  contactPhone: null,
  address: null,
  website: null,
  description: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { communicationLogs: 5, consultationFeedback: 2 },
};

const mockCommunicationLog = {
  id: 'log-1',
  stakeholderId: 'stakeholder-1',
  subject: 'Consultation Invitation',
  content: 'Dear Qatar Chamber, we invite you...',
  channel: 'EMAIL',
  direction: 'OUTBOUND',
  sentAt: new Date(),
  createdAt: new Date(),
};

const mockPrisma = {
  stakeholder: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  stakeholderCommunicationLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('StakeholdersService', () => {
  let service: StakeholdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StakeholdersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<StakeholdersService>(StakeholdersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a stakeholder with isActive defaulting to true', async () => {
      mockPrisma.stakeholder.create.mockResolvedValue(mockStakeholder);
      const result = await service.create({
        name: 'Qatar Chamber of Commerce',
        type: StakeholderType.PRIVATE_SECTOR,
      });
      expect(mockPrisma.stakeholder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Qatar Chamber of Commerce',
            type: StakeholderType.PRIVATE_SECTOR,
            isActive: true,
          }),
        }),
      );
      expect(result).toEqual(mockStakeholder);
    });
  });

  describe('findAll', () => {
    it('returns paginated stakeholders', async () => {
      mockPrisma.stakeholder.findMany.mockResolvedValue([mockStakeholder]);
      mockPrisma.stakeholder.count.mockResolvedValue(1);
      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.data).toEqual([mockStakeholder]);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('filters by type', async () => {
      mockPrisma.stakeholder.findMany.mockResolvedValue([]);
      mockPrisma.stakeholder.count.mockResolvedValue(0);
      await service.findAll({ type: StakeholderType.NGO });
      expect(mockPrisma.stakeholder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: StakeholderType.NGO }),
        }),
      );
    });

    it('applies search across name and email', async () => {
      mockPrisma.stakeholder.findMany.mockResolvedValue([]);
      mockPrisma.stakeholder.count.mockResolvedValue(0);
      await service.findAll({ search: 'chamber' });
      expect(mockPrisma.stakeholder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.objectContaining({ contains: 'chamber' }) }),
            ]),
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns stakeholder when found', async () => {
      mockPrisma.stakeholder.findUnique.mockResolvedValue(mockStakeholder);
      const result = await service.findById('stakeholder-1');
      expect(result).toEqual(mockStakeholder);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.stakeholder.findUnique.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates and returns the stakeholder', async () => {
      mockPrisma.stakeholder.findUnique.mockResolvedValue(mockStakeholder);
      const updated = { ...mockStakeholder, name: 'Updated Chamber' };
      mockPrisma.stakeholder.update.mockResolvedValue(updated);
      const result = await service.update('stakeholder-1', { name: 'Updated Chamber' });
      expect(result.name).toBe('Updated Chamber');
    });

    it('throws NotFoundException when stakeholder does not exist', async () => {
      mockPrisma.stakeholder.findUnique.mockResolvedValue(null);
      await expect(service.update('nonexistent', { name: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes the stakeholder', async () => {
      mockPrisma.stakeholder.findUnique.mockResolvedValue(mockStakeholder);
      mockPrisma.stakeholder.delete.mockResolvedValue(mockStakeholder);
      await service.delete('stakeholder-1');
      expect(mockPrisma.stakeholder.delete).toHaveBeenCalledWith({
        where: { id: 'stakeholder-1' },
      });
    });

    it('throws NotFoundException when stakeholder does not exist', async () => {
      mockPrisma.stakeholder.findUnique.mockResolvedValue(null);
      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('logCommunication', () => {
    it('creates a communication log entry', async () => {
      mockPrisma.stakeholder.findUnique.mockResolvedValue(mockStakeholder);
      mockPrisma.stakeholderCommunicationLog.create.mockResolvedValue(mockCommunicationLog);
      const result = await service.logCommunication('stakeholder-1', {
        subject: 'Consultation Invitation',
        content: 'Dear Qatar Chamber, we invite you...',
        channel: 'EMAIL',
        direction: 'OUTBOUND',
      });
      expect(mockPrisma.stakeholderCommunicationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stakeholderId: 'stakeholder-1',
            subject: 'Consultation Invitation',
            channel: 'EMAIL',
          }),
        }),
      );
      expect(result).toEqual(mockCommunicationLog);
    });

    it('throws NotFoundException when stakeholder does not exist', async () => {
      mockPrisma.stakeholder.findUnique.mockResolvedValue(null);
      await expect(
        service.logCommunication('nonexistent', { subject: 'Test', content: 'Content' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCommunicationLogs', () => {
    it('returns communication logs for a stakeholder', async () => {
      mockPrisma.stakeholder.findUnique.mockResolvedValue(mockStakeholder);
      mockPrisma.stakeholderCommunicationLog.findMany.mockResolvedValue([mockCommunicationLog]);
      const result = await service.getCommunicationLogs('stakeholder-1');
      expect(result).toEqual([mockCommunicationLog]);
    });

    it('throws NotFoundException when stakeholder does not exist', async () => {
      mockPrisma.stakeholder.findUnique.mockResolvedValue(null);
      await expect(service.getCommunicationLogs('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
