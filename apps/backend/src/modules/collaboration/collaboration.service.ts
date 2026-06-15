import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CollaborationGateway } from './collaboration.gateway';
import { AcquireLockDto, AutosaveDto } from './dto/collaboration.dto';

const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const MAX_AUTOSAVES = 5;

@Injectable()
export class CollaborationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: CollaborationGateway,
  ) {}

  // ── Document Locking ──────────────────────────────────────────────────────

  async acquireLock(legislativeItemId: string, userId: string, dto: AcquireLockDto) {
    await this.ensureItemExists(legislativeItemId);

    const existingLock = await this.prisma.documentLock.findUnique({
      where: { legislativeItemId },
      include: { lockedBy: { select: { id: true, firstName: true, lastName: true } } },
    });

    if (existingLock) {
      // Check if expired
      if (existingLock.expiresAt > new Date()) {
        if (existingLock.lockedById !== userId) {
          throw new ConflictException(
            `Document is locked by ${existingLock.lockedBy.firstName} ${existingLock.lockedBy.lastName}`,
          );
        }
        // Re-extend lock for same user
        return this.prisma.documentLock.update({
          where: { legislativeItemId },
          data: {
            expiresAt: new Date(Date.now() + LOCK_DURATION_MS),
            sessionId: dto.sessionId,
          },
          include: { lockedBy: { select: { id: true, firstName: true, lastName: true } } },
        });
      }

      // Lock is expired, delete it and acquire new one
      await this.prisma.documentLock.delete({ where: { legislativeItemId } });
    }

    return this.prisma.documentLock.create({
      data: {
        legislativeItemId,
        lockedById: userId,
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + LOCK_DURATION_MS),
        sessionId: dto.sessionId,
      },
      include: { lockedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async releaseLock(legislativeItemId: string, userId: string) {
    const lock = await this.prisma.documentLock.findUnique({
      where: { legislativeItemId },
    });

    if (!lock) throw new NotFoundException('No lock found for this document');
    if (lock.lockedById !== userId) {
      throw new ForbiddenException('You do not hold the lock for this document');
    }

    await this.prisma.documentLock.delete({ where: { legislativeItemId } });
    return { released: true };
  }

  async checkLock(legislativeItemId: string) {
    const lock = await this.prisma.documentLock.findUnique({
      where: { legislativeItemId },
      include: { lockedBy: { select: { id: true, firstName: true, lastName: true } } },
    });

    if (!lock) return null;
    if (lock.expiresAt <= new Date()) {
      await this.prisma.documentLock.delete({ where: { legislativeItemId } });
      return null;
    }
    return lock;
  }

  // ── Autosave ──────────────────────────────────────────────────────────────

  async autoSave(legislativeItemId: string, dto: AutosaveDto, userId: string) {
    await this.ensureItemExists(legislativeItemId);

    // Create new snapshot
    const snapshot = await this.prisma.autosaveSnapshot.create({
      data: {
        legislativeItemId,
        content: dto.content,
        savedById: userId,
      },
      include: { savedBy: { select: { id: true, firstName: true, lastName: true } } },
    });

    // Keep only last MAX_AUTOSAVES snapshots
    const allSnapshots = await this.prisma.autosaveSnapshot.findMany({
      where: { legislativeItemId },
      orderBy: { savedAt: 'desc' },
      select: { id: true },
    });

    if (allSnapshots.length > MAX_AUTOSAVES) {
      const toDelete = allSnapshots.slice(MAX_AUTOSAVES).map((s) => s.id);
      await this.prisma.autosaveSnapshot.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    return snapshot;
  }

  async getAutosaveHistory(legislativeItemId: string) {
    await this.ensureItemExists(legislativeItemId);
    return this.prisma.autosaveSnapshot.findMany({
      where: { legislativeItemId },
      orderBy: { savedAt: 'desc' },
      take: MAX_AUTOSAVES,
      select: {
        id: true,
        legislativeItemId: true,
        savedById: true,
        savedAt: true,
        savedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  // ── Presence ──────────────────────────────────────────────────────────────

  getPresence(documentId: string): string[] {
    return this.gateway.getPresence(documentId);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async ensureItemExists(id: string) {
    const item = await this.prisma.legislativeItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`LegislativeItem ${id} not found`);
    return item;
  }
}
