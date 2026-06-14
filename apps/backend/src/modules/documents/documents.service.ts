import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { IStorageProvider, STORAGE_PROVIDER } from '../storage/storage.interface';
import { UploadDocumentDto, DocumentQueryDto } from './dto/document.dto';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'image/png',
  'image/jpeg',
]);

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {}

  private validateFile(file: Express.Multer.File): void {
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(`File exceeds maximum size of 50 MB`);
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not allowed. Allowed types: pdf, docx, doc, xlsx, xls, pptx, txt, png, jpg, jpeg`,
      );
    }
  }

  async upload(
    file: Express.Multer.File,
    dto: UploadDocumentDto,
    userId: string,
  ) {
    this.validateFile(file);

    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const ext = file.originalname.split('.').pop() ?? 'bin';
    const storagePath = `${dto.legislativeItemId ?? 'unlinked'}/${Date.now()}-${checksum.slice(0, 8)}.${ext}`;

    const { path } = await this.storage.upload(file, storagePath);

    return this.prisma.document.create({
      data: {
        legislativeItemId: dto.legislativeItemId!,
        uploadedById: userId,
        originalName: file.originalname,
        storagePath: path,
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.size),
        category: dto.category ?? 'DRAFT',
        title: dto.title,
        description: dto.description,
        checksum,
      },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findAll(query: DocumentQueryDto) {
    const { page = 1, limit = 20, legislativeItemId, category } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(legislativeItemId && { legislativeItemId }),
      ...(category && { category }),
    };

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!doc) throw new NotFoundException(`Document ${id} not found`);
    return doc;
  }

  async getDownloadUrl(id: string): Promise<{ url: string; filename: string }> {
    const doc = await this.findById(id);
    const url = await this.storage.getSignedUrl(doc.storagePath);
    return { url, filename: doc.originalName };
  }

  async delete(id: string): Promise<void> {
    const doc = await this.findById(id);
    await this.storage.delete(doc.storagePath);
    await this.prisma.document.delete({ where: { id } });
  }
}
