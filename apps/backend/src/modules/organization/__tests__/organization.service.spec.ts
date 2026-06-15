import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrganizationService } from '../organization.service';
import { PrismaService } from '../../database/prisma.service';

const MOCK_DEPT = {
  id: 'dept-uuid-1',
  name: 'Legal Affairs',
  code: 'LA-001',
  description: null,
  ministryId: 'min-uuid-1',
  parentId: null,
  headUserId: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  units: [],
  children: [],
};

const MOCK_UNIT = {
  id: 'unit-uuid-1',
  name: 'Drafting Unit',
  code: 'DU-001',
  departmentId: 'dept-uuid-1',
  headUserId: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  department: MOCK_DEPT,
};

function makeMockPrisma() {
  return {
    department: {
      findUnique: jest.fn().mockResolvedValue(MOCK_DEPT),
      findMany: jest.fn().mockResolvedValue([MOCK_DEPT]),
      create: jest.fn().mockResolvedValue(MOCK_DEPT),
      update: jest.fn().mockResolvedValue({ ...MOCK_DEPT, name: 'Updated' }),
      delete: jest.fn().mockResolvedValue(MOCK_DEPT),
    },
    unit: {
      findUnique: jest.fn().mockResolvedValue(MOCK_UNIT),
      findMany: jest.fn().mockResolvedValue([MOCK_UNIT]),
      create: jest.fn().mockResolvedValue(MOCK_UNIT),
      update: jest.fn().mockResolvedValue({ ...MOCK_UNIT, name: 'Updated Unit' }),
      delete: jest.fn().mockResolvedValue(MOCK_UNIT),
    },
    ministry: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'min-uuid-1', name: 'MOJ', code: 'MOJ', departments: [{ ...MOCK_DEPT, units: [] }] },
      ]),
    },
  };
}

describe('OrganizationService', () => {
  let service: OrganizationService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<OrganizationService>(OrganizationService);
  });

  // ---------------------------------------------------------------------------
  // Departments
  // ---------------------------------------------------------------------------

  describe('createDepartment', () => {
    it('creates a department', async () => {
      const result = await service.createDepartment({
        name: 'Legal Affairs',
        code: 'LA-001',
        ministryId: 'min-uuid-1',
      });
      expect(result).toEqual(MOCK_DEPT);
      expect(mockPrisma.department.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Legal Affairs', code: 'LA-001' }),
        }),
      );
    });
  });

  describe('findAllDepartments', () => {
    it('returns all departments', async () => {
      const result = await service.findAllDepartments();
      expect(Array.isArray(result)).toBe(true);
      expect(mockPrisma.department.findMany).toHaveBeenCalled();
    });

    it('filters by ministryId when provided', async () => {
      await service.findAllDepartments('min-uuid-1');
      expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ministryId: 'min-uuid-1' } }),
      );
    });
  });

  describe('findDepartmentById', () => {
    it('returns department by id', async () => {
      const result = await service.findDepartmentById('dept-uuid-1');
      expect(result).toEqual(MOCK_DEPT);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.department.findUnique.mockResolvedValueOnce(null);
      await expect(service.findDepartmentById('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeDepartment', () => {
    it('deletes and returns deleted:true', async () => {
      const result = await service.removeDepartment('dept-uuid-1');
      expect(result).toEqual({ deleted: true });
    });
  });

  // ---------------------------------------------------------------------------
  // Units
  // ---------------------------------------------------------------------------

  describe('createUnit', () => {
    it('creates a unit', async () => {
      const result = await service.createUnit({
        name: 'Drafting',
        code: 'DU-001',
        departmentId: 'dept-uuid-1',
      });
      expect(result).toEqual(MOCK_UNIT);
    });
  });

  describe('findUnitById', () => {
    it('returns unit by id', async () => {
      const result = await service.findUnitById('unit-uuid-1');
      expect(result).toEqual(MOCK_UNIT);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.unit.findUnique.mockResolvedValueOnce(null);
      await expect(service.findUnitById('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // getDepartmentTree
  // ---------------------------------------------------------------------------

  describe('getDepartmentTree', () => {
    it('returns tree with children nested', async () => {
      const child = { ...MOCK_DEPT, id: 'dept-child', parentId: 'dept-uuid-1', units: [] };
      mockPrisma.department.findMany.mockResolvedValueOnce([
        { ...MOCK_DEPT, units: [] },
        child,
      ]);
      const tree = await service.getDepartmentTree('min-uuid-1');
      expect(tree).toHaveLength(1);
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].id).toBe('dept-child');
    });
  });
});
