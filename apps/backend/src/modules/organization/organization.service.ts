import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

interface DepartmentNode {
  id: string;
  name: string;
  code: string;
  description: string | null;
  ministryId: string;
  parentId: string | null;
  headUserId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  units: Array<{ id: string; name: string; code: string; isActive: boolean }>;
  children: DepartmentNode[];
}

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Departments
  // -------------------------------------------------------------------------

  async createDepartment(dto: CreateDepartmentDto) {
    return this.prisma.department.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        ministryId: dto.ministryId,
        parentId: dto.parentId,
        headUserId: dto.headUserId,
        isActive: dto.isActive ?? true,
      },
      include: { units: true, children: true },
    });
  }

  async findAllDepartments(ministryId?: string) {
    return this.prisma.department.findMany({
      where: ministryId ? { ministryId } : undefined,
      include: { units: true },
      orderBy: { name: 'asc' },
    });
  }

  async findDepartmentById(id: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: { units: true, children: { include: { units: true } } },
    });
    if (!dept) throw new NotFoundException(`Department ${id} not found`);
    return dept;
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    await this.findDepartmentById(id);
    return this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.headUserId !== undefined && { headUserId: dto.headUserId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { units: true },
    });
  }

  async removeDepartment(id: string) {
    await this.findDepartmentById(id);
    await this.prisma.department.delete({ where: { id } });
    return { deleted: true };
  }

  async getDepartmentTree(ministryId: string): Promise<DepartmentNode[]> {
    const allDepts = await this.prisma.department.findMany({
      where: { ministryId },
      include: { units: true },
      orderBy: { name: 'asc' },
    });

    const map = new Map<string, DepartmentNode>();
    allDepts.forEach((d) =>
      map.set(d.id, {
        ...d,
        units: d.units.map((u) => ({ id: u.id, name: u.name, code: u.code, isActive: u.isActive })),
        children: [],
      }),
    );

    const roots: DepartmentNode[] = [];
    map.forEach((node) => {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  // -------------------------------------------------------------------------
  // Units
  // -------------------------------------------------------------------------

  async createUnit(dto: CreateUnitDto) {
    return this.prisma.unit.create({
      data: {
        name: dto.name,
        code: dto.code,
        departmentId: dto.departmentId,
        headUserId: dto.headUserId,
        isActive: dto.isActive ?? true,
      },
      include: { department: true },
    });
  }

  async findAllUnits(departmentId?: string) {
    return this.prisma.unit.findMany({
      where: departmentId ? { departmentId } : undefined,
      include: { department: true },
      orderBy: { name: 'asc' },
    });
  }

  async findUnitById(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: { department: true },
    });
    if (!unit) throw new NotFoundException(`Unit ${id} not found`);
    return unit;
  }

  async updateUnit(id: string, dto: UpdateUnitDto) {
    await this.findUnitById(id);
    return this.prisma.unit.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.headUserId !== undefined && { headUserId: dto.headUserId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { department: true },
    });
  }

  async removeUnit(id: string) {
    await this.findUnitById(id);
    await this.prisma.unit.delete({ where: { id } });
    return { deleted: true };
  }

  // -------------------------------------------------------------------------
  // Full hierarchy across all ministries
  // -------------------------------------------------------------------------

  async getHierarchy() {
    const ministries = await this.prisma.ministry.findMany({
      where: { isActive: true },
      include: {
        departments: {
          include: { units: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return ministries.map((m) => ({
      id: m.id,
      name: m.name,
      code: m.code,
      departments: m.departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        parentId: d.parentId,
        isActive: d.isActive,
        units: d.units.map((u) => ({
          id: u.id,
          name: u.name,
          code: u.code,
          isActive: u.isActive,
        })),
      })),
    }));
  }
}
