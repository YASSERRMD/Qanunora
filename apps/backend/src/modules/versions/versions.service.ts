import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface ContentSnapshot {
  [key: string]: unknown;
}

export interface DiffEntry {
  field: string;
  v1Value: unknown;
  v2Value: unknown;
  changed: boolean;
}

export interface VersionCompareResult {
  v1: { id: string; versionNumber: number; label?: string | null; createdAt: Date };
  v2: { id: string; versionNumber: number; label?: string | null; createdAt: Date };
  diff: DiffEntry[];
  totalChanges: number;
}

@Injectable()
export class VersionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createVersion(params: {
    legislativeItemId: string;
    documentId?: string;
    label?: string;
    notes?: string;
    contentSnapshot?: ContentSnapshot;
    createdById: string;
  }) {
    const lastVersion = await this.prisma.version.findFirst({
      where: { legislativeItemId: params.legislativeItemId },
      orderBy: { versionNumber: 'desc' },
    });

    const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    return this.prisma.version.create({
      data: {
        legislativeItemId: params.legislativeItemId,
        documentId: params.documentId,
        versionNumber,
        label: params.label,
        notes: params.notes,
        contentSnapshot: params.contentSnapshot as object ?? {},
        createdById: params.createdById,
      },
    });
  }

  async findAll(legislativeItemId: string) {
    const versions = await this.prisma.version.findMany({
      where: { legislativeItemId },
      orderBy: { versionNumber: 'desc' },
      include: {
        document: {
          select: { id: true, originalName: true, mimeType: true },
        },
      },
    });

    return { data: versions, total: versions.length };
  }

  async findById(id: string) {
    const version = await this.prisma.version.findUnique({
      where: { id },
      include: {
        document: {
          select: { id: true, originalName: true, mimeType: true },
        },
        legislativeItem: {
          select: { id: true, referenceNumber: true, title: true },
        },
      },
    });

    if (!version) throw new NotFoundException(`Version ${id} not found`);
    return version;
  }

  async restoreVersion(legislativeItemId: string, versionId: string, userId: string) {
    const version = await this.findById(versionId);

    if (version.legislativeItemId !== legislativeItemId) {
      throw new NotFoundException(`Version ${versionId} does not belong to item ${legislativeItemId}`);
    }

    // Create a new version with the snapshot from the restored version
    return this.createVersion({
      legislativeItemId,
      documentId: version.documentId ?? undefined,
      label: `Restored from v${version.versionNumber}`,
      notes: `Restored snapshot from version ${version.versionNumber}${version.label ? ` (${version.label})` : ''}`,
      contentSnapshot: (version.contentSnapshot as ContentSnapshot) ?? {},
      createdById: userId,
    });
  }

  async compareVersions(v1Id: string, v2Id: string): Promise<VersionCompareResult> {
    const [v1, v2] = await Promise.all([this.findById(v1Id), this.findById(v2Id)]);

    const snap1 = (v1.contentSnapshot as ContentSnapshot) ?? {};
    const snap2 = (v2.contentSnapshot as ContentSnapshot) ?? {};

    const allKeys = new Set([...Object.keys(snap1), ...Object.keys(snap2)]);

    const diff: DiffEntry[] = Array.from(allKeys).map((key) => {
      const v1Value = snap1[key] ?? null;
      const v2Value = snap2[key] ?? null;
      return {
        field: key,
        v1Value,
        v2Value,
        changed: JSON.stringify(v1Value) !== JSON.stringify(v2Value),
      };
    });

    const totalChanges = diff.filter((d) => d.changed).length;

    return {
      v1: {
        id: v1.id,
        versionNumber: v1.versionNumber,
        label: v1.label,
        createdAt: v1.createdAt,
      },
      v2: {
        id: v2.id,
        versionNumber: v2.versionNumber,
        label: v2.label,
        createdAt: v2.createdAt,
      },
      diff,
      totalChanges,
    };
  }
}
