import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EditType } from '@prisma/client';
import { SaveEditDto, AddCommentDto } from './dto/document-editor.dto';

@Injectable()
export class DocumentEditorService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Snapshot & Edit History ──────────────────────────────────────────────

  async saveEdit(
    legislativeItemId: string,
    dto: SaveEditDto,
    userId: string,
  ) {
    await this.ensureItemExists(legislativeItemId);

    const wordCount = dto.content
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    const characterCount = dto.content.length;

    return this.prisma.documentEdit.create({
      data: {
        legislativeItemId,
        editorId: userId,
        contentSnapshot: dto.content,
        changeDescription: dto.changeDescription,
        editType: dto.editType ?? EditType.CONTENT,
        wordCount,
        characterCount,
      },
      include: {
        editor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getEditHistory(legislativeItemId: string) {
    await this.ensureItemExists(legislativeItemId);
    return this.prisma.documentEdit.findMany({
      where: { legislativeItemId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        legislativeItemId: true,
        editorId: true,
        editType: true,
        changeDescription: true,
        wordCount: true,
        characterCount: true,
        createdAt: true,
        editor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getEditById(id: string) {
    const edit = await this.prisma.documentEdit.findUnique({
      where: { id },
      include: {
        editor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!edit) throw new NotFoundException(`DocumentEdit ${id} not found`);
    return edit;
  }

  diffEdits(
    content1: string,
    content2: string,
  ): { added: string[]; removed: string[]; unchanged: string[] } {
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');

    const set1 = new Set(lines1);
    const set2 = new Set(lines2);

    const added: string[] = [];
    const removed: string[] = [];
    const unchanged: string[] = [];

    for (const line of lines2) {
      if (set1.has(line)) {
        unchanged.push(line);
      } else {
        added.push(line);
      }
    }

    for (const line of lines1) {
      if (!set2.has(line)) {
        removed.push(line);
      }
    }

    return { added, removed, unchanged };
  }

  async diffEditsByIds(editId1: string, editId2: string) {
    const [edit1, edit2] = await Promise.all([
      this.getEditById(editId1),
      this.getEditById(editId2),
    ]);
    return this.diffEdits(edit1.contentSnapshot, edit2.contentSnapshot);
  }

  // ── Comments ─────────────────────────────────────────────────────────────

  async addComment(
    legislativeItemId: string,
    dto: AddCommentDto,
    userId: string,
  ) {
    await this.ensureItemExists(legislativeItemId);
    return this.prisma.editorComment.create({
      data: {
        legislativeItemId,
        authorId: userId,
        content: dto.content,
        articleRef: dto.articleRef,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async resolveComment(commentId: string, userId: string) {
    const comment = await this.prisma.editorComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException(`EditorComment ${commentId} not found`);
    if (comment.isResolved) throw new BadRequestException('Comment is already resolved');

    return this.prisma.editorComment.update({
      where: { id: commentId },
      data: {
        isResolved: true,
        resolvedById: userId,
        resolvedAt: new Date(),
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getComments(legislativeItemId: string, includeResolved = false) {
    await this.ensureItemExists(legislativeItemId);
    const where: Record<string, unknown> = { legislativeItemId };
    if (!includeResolved) where['isResolved'] = false;

    return this.prisma.editorComment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  // ── Numbered Content ──────────────────────────────────────────────────────

  async getNumberedContent(legislativeItemId: string): Promise<string> {
    await this.ensureItemExists(legislativeItemId);

    const structures = await this.prisma.legalStructure.findMany({
      where: { legislativeItemId },
      orderBy: { order: 'asc' },
    });

    const lines: string[] = [];

    for (const s of structures) {
      switch (s.type) {
        case 'CHAPTER':
          lines.push(`Chapter ${s.number}: ${s.title ?? ''}`);
          if (s.content) lines.push(`  ${s.content}`);
          break;
        case 'SECTION':
          lines.push(`  Section ${s.number}: ${s.title ?? ''}`);
          if (s.content) lines.push(`    ${s.content}`);
          break;
        case 'ARTICLE':
          lines.push(`Article ${s.number}: ${s.title ?? ''}`);
          if (s.content) lines.push(`  ${s.content}`);
          break;
        case 'CLAUSE':
          lines.push(`  ${s.number}. ${s.content ?? s.title ?? ''}`);
          break;
        default:
          lines.push(`${s.number}. ${s.title ?? ''}`);
      }
    }

    return lines.join('\n');
  }

  async exportAsText(legislativeItemId: string) {
    const content = await this.getNumberedContent(legislativeItemId);
    const item = await this.prisma.legislativeItem.findUnique({
      where: { id: legislativeItemId },
      select: { title: true, referenceNumber: true },
    });
    return {
      title: item?.title ?? legislativeItemId,
      referenceNumber: item?.referenceNumber ?? '',
      content,
      exportedAt: new Date().toISOString(),
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async ensureItemExists(id: string) {
    const item = await this.prisma.legislativeItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`LegislativeItem ${id} not found`);
    return item;
  }
}
