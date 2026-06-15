import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { SearchFacetsService } from '../search-facets.service';
import { PrismaService } from '../../database/prisma.service';
import { LegislativeStatus, LegislativeItemType, Priority, ConfidentialityLevel } from '@prisma/client';

const mockItems = [
  {
    status: LegislativeStatus.DRAFTING,
    type: LegislativeItemType.DRAFT_LAW,
    ministryId: 'min-1',
    confidentialityLevel: ConfidentialityLevel.INTERNAL,
    priority: Priority.HIGH,
    createdAt: new Date('2025-01-15'),
  },
  {
    status: LegislativeStatus.APPROVED,
    type: LegislativeItemType.BILL,
    ministryId: 'min-2',
    confidentialityLevel: ConfidentialityLevel.PUBLIC,
    priority: Priority.MEDIUM,
    createdAt: new Date('2024-06-10'),
  },
];

const mockMinistries = [
  { id: 'min-1', name: 'Ministry of Justice' },
  { id: 'min-2', name: 'Ministry of Finance' },
];

const mockSavedSearch = {
  id: 'ss-1',
  userId: 'user-1',
  name: 'My Search',
  query: 'banking law',
  filters: {},
  searchType: 'keyword',
  hitCount: 3,
  lastRunAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  legislativeItem: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  ministry: { findMany: jest.fn() },
  savedSearch: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

describe('SearchFacetsService', () => {
  let service: SearchFacetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchFacetsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SearchFacetsService>(SearchFacetsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getFacets', () => {
    it('aggregates counts by status, type, ministry, confidentiality, priority, and year', async () => {
      mockPrisma.legislativeItem.findMany.mockResolvedValue(mockItems);
      mockPrisma.ministry.findMany.mockResolvedValue(mockMinistries);

      const result = await service.getFacets();

      expect(result.byStatus[LegislativeStatus.DRAFTING]).toBe(1);
      expect(result.byStatus[LegislativeStatus.APPROVED]).toBe(1);
      expect(result.byType[LegislativeItemType.DRAFT_LAW]).toBe(1);
      expect(result.byMinistry).toHaveLength(2);
      expect(result.byMinistry.find((m: {id: string; name: string}) => m.id === 'min-1')?.name).toBe('Ministry of Justice');
      expect(result.byYear).toHaveLength(5);
    });
  });

  describe('searchWithFacets', () => {
    it('returns paginated results with facets', async () => {
      mockPrisma.legislativeItem.findMany
        .mockResolvedValueOnce(mockItems) // for search results
        .mockResolvedValueOnce(mockItems); // for facets (getFacets)
      mockPrisma.legislativeItem.count.mockResolvedValue(2);
      mockPrisma.ministry.findMany.mockResolvedValue(mockMinistries);

      const result = await service.searchWithFacets({ query: 'law', page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.facets).toBeDefined();
    });

    it('applies status filter', async () => {
      mockPrisma.legislativeItem.findMany.mockResolvedValue([]);
      mockPrisma.legislativeItem.count.mockResolvedValue(0);
      mockPrisma.ministry.findMany.mockResolvedValue([]);

      await service.searchWithFacets({ status: [LegislativeStatus.DRAFTING] });

      expect(mockPrisma.legislativeItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { in: [LegislativeStatus.DRAFTING] } }),
        }),
      );
    });
  });

  describe('saveSearch', () => {
    it('creates a saved search for the user', async () => {
      mockPrisma.savedSearch.create.mockResolvedValue(mockSavedSearch);

      const result = await service.saveSearch('user-1', {
        name: 'My Search',
        query: 'banking law',
      });

      expect(result).toEqual(mockSavedSearch);
      expect(mockPrisma.savedSearch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-1', name: 'My Search' }),
        }),
      );
    });
  });

  describe('deleteSavedSearch', () => {
    it('deletes a saved search owned by the user', async () => {
      mockPrisma.savedSearch.findUnique.mockResolvedValue(mockSavedSearch);
      mockPrisma.savedSearch.delete.mockResolvedValue({});

      const result = await service.deleteSavedSearch('ss-1', 'user-1');
      expect(result).toEqual({ deleted: true });
    });

    it('throws ForbiddenException when not owner', async () => {
      mockPrisma.savedSearch.findUnique.mockResolvedValue({ ...mockSavedSearch, userId: 'user-2' });
      await expect(service.deleteSavedSearch('ss-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.savedSearch.findUnique.mockResolvedValue(null);
      await expect(service.deleteSavedSearch('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('runSavedSearch', () => {
    it('executes the saved search and increments hitCount', async () => {
      mockPrisma.savedSearch.findUnique.mockResolvedValue(mockSavedSearch);
      mockPrisma.legislativeItem.findMany.mockResolvedValue(mockItems);
      mockPrisma.legislativeItem.count.mockResolvedValue(2);
      mockPrisma.ministry.findMany.mockResolvedValue(mockMinistries);
      mockPrisma.savedSearch.update.mockResolvedValue({ ...mockSavedSearch, hitCount: 4 });

      const result = await service.runSavedSearch('ss-1', 'user-1');

      expect(result.data).toHaveLength(2);
      expect(mockPrisma.savedSearch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ hitCount: { increment: 1 } }),
        }),
      );
    });
  });

  describe('getSearchAnalytics', () => {
    it('returns top saved searches and count', async () => {
      mockPrisma.savedSearch.findMany.mockResolvedValue([mockSavedSearch]);
      mockPrisma.savedSearch.count.mockResolvedValue(1);

      const result = await service.getSearchAnalytics('user-1');

      expect(result.topSavedSearches).toHaveLength(1);
      expect(result.totalSavedSearches).toBe(1);
    });
  });
});
