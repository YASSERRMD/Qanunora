import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LegalStructure } from '@prisma/client';
import {
  CreateLegalStructureDto,
  UpdateLegalStructureDto,
  ReorderItemDto,
} from './dto/legal-structure.dto';

export interface LegalStructureNode extends LegalStructure {
  children: LegalStructureNode[];
}

@Injectable()
export class LegalStructureService {
  constructor(private readonly prisma: PrismaService) {}

  async create(legislativeItemId: string, dto: CreateLegalStructureDto) {
    return this.prisma.legalStructure.create({
      data: {
        legislativeItemId,
        type: dto.type,
        number: dto.number,
        title: dto.title,
        content: dto.content,
        order: dto.order,
        parentId: dto.parentId,
      },
      include: {
        parent: { select: { id: true, type: true, number: true, title: true } },
        children: { orderBy: { order: 'asc' } },
      },
    });
  }

  async findAll(legislativeItemId: string) {
    return this.prisma.legalStructure.findMany({
      where: { legislativeItemId },
      orderBy: [{ order: 'asc' }],
      include: {
        parent: { select: { id: true, type: true, number: true } },
        _count: { select: { children: true } },
      },
    });
  }

  async findById(id: string) {
    const node = await this.prisma.legalStructure.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, type: true, number: true, title: true } },
        children: {
          orderBy: { order: 'asc' },
          include: {
            children: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
    if (!node) throw new NotFoundException(`Legal structure ${id} not found`);
    return node;
  }

  async update(id: string, dto: UpdateLegalStructureDto) {
    await this.findById(id);
    return this.prisma.legalStructure.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.number !== undefined && { number: dto.number }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      },
      include: {
        parent: { select: { id: true, type: true, number: true, title: true } },
        children: { orderBy: { order: 'asc' } },
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.legalStructure.delete({ where: { id } });
  }

  async reorder(legislativeItemId: string, items: ReorderItemDto[]) {
    await Promise.all(
      items.map((item) =>
        this.prisma.legalStructure.updateMany({
          where: { id: item.id, legislativeItemId },
          data: { order: item.order },
        }),
      ),
    );
    return this.getTree(legislativeItemId);
  }

  async getTree(legislativeItemId: string): Promise<LegalStructureNode[]> {
    const all = await this.prisma.legalStructure.findMany({
      where: { legislativeItemId },
      orderBy: { order: 'asc' },
    });

    const map = new Map<string, LegalStructureNode>();
    for (const node of all) {
      map.set(node.id, { ...node, children: [] });
    }

    const roots: LegalStructureNode[] = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
