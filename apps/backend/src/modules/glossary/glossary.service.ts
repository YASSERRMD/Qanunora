import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AiProviderFactory } from '../ai-providers/ai-provider.factory';
import { TermStatus } from '@prisma/client';
import {
  CreateGlossaryTermDto,
  UpdateGlossaryTermDto,
  GlossaryQueryDto,
  SuggestTermsDto,
} from './dto/glossary.dto';

interface AiSuggestedTerm {
  termEn: string;
  termAr?: string;
  definition: string;
  domain: string;
  category?: string;
}

@Injectable()
export class GlossaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiFactory: AiProviderFactory,
  ) {}

  async create(dto: CreateGlossaryTermDto, userId: string) {
    const existing = await this.prisma.glossaryTerm.findUnique({
      where: { termEn_domain: { termEn: dto.termEn, domain: dto.domain ?? 'general' } },
    });
    if (existing) {
      throw new ConflictException(
        `Term "${dto.termEn}" already exists in domain "${dto.domain ?? 'general'}"`,
      );
    }

    return this.prisma.glossaryTerm.create({
      data: {
        termEn: dto.termEn,
        termAr: dto.termAr,
        definition: dto.definition,
        definitionAr: dto.definitionAr,
        domain: dto.domain ?? 'general',
        category: dto.category,
        status: dto.status ?? TermStatus.ACTIVE,
        isPreferred: dto.isPreferred ?? true,
        relatedTermIds: dto.relatedTermIds ?? [],
        source: dto.source,
        createdById: userId,
      },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async findAll(query: GlossaryQueryDto) {
    const { search, domain, category, status, page = 1, limit = 30 } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {
      ...(domain && { domain }),
      ...(category && { category }),
      ...(status && { status: status as TermStatus }),
      ...(search && {
        OR: [
          { termEn: { contains: search, mode: 'insensitive' } },
          { termAr: { contains: search, mode: 'insensitive' } },
          { definition: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.glossaryTerm.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { termEn: 'asc' },
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.glossaryTerm.count({ where }),
    ]);

    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  async findById(id: string) {
    const term = await this.prisma.glossaryTerm.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!term) throw new NotFoundException(`Glossary term ${id} not found`);
    return term;
  }

  async update(id: string, dto: UpdateGlossaryTermDto, userId: string) {
    await this.findById(id);
    return this.prisma.glossaryTerm.update({
      where: { id },
      data: {
        ...(dto.termEn !== undefined && { termEn: dto.termEn }),
        ...(dto.termAr !== undefined && { termAr: dto.termAr }),
        ...(dto.definition !== undefined && { definition: dto.definition }),
        ...(dto.definitionAr !== undefined && { definitionAr: dto.definitionAr }),
        ...(dto.domain !== undefined && { domain: dto.domain }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.isPreferred !== undefined && { isPreferred: dto.isPreferred }),
        ...(dto.relatedTermIds !== undefined && { relatedTermIds: dto.relatedTermIds }),
        ...(dto.source !== undefined && { source: dto.source }),
      },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async deprecate(id: string, userId: string) {
    await this.findById(id);
    return this.prisma.glossaryTerm.update({
      where: { id },
      data: { status: TermStatus.DEPRECATED },
    });
  }

  async suggestTerm(dto: SuggestTermsDto, userId: string) {
    const domain = dto.domain ?? 'legal';
    const provider = this.aiFactory.getProvider();

    const result = await provider.complete({
      messages: [
        {
          role: 'system',
          content: `You are a legal terminology expert for a government legislative platform.
Analyse the provided legal text and identify important legal terms that should be defined in a glossary.
Domain: ${domain}.
Return ONLY a valid JSON array (no markdown, no explanation):
[
  {
    "termEn": "English term",
    "termAr": "Arabic equivalent term (if known, otherwise null)",
    "definition": "Clear, formal definition in English",
    "domain": "${domain}",
    "category": "category name (e.g., contract_law, constitutional, administrative, etc.)"
  }
]
Suggest between 3 and 10 terms. Only suggest terms that are legal/legislative in nature.`,
        },
        {
          role: 'user',
          content: `Analyse this text and suggest glossary terms:\n\n${dto.text}`,
        },
      ],
      temperature: 0.3,
      maxTokens: 2048,
      jsonMode: true,
    });

    let suggestions: AiSuggestedTerm[];
    try {
      suggestions = JSON.parse(result.content) as AiSuggestedTerm[];
      if (!Array.isArray(suggestions)) throw new Error('Not an array');
    } catch {
      suggestions = [];
    }

    // Create PROPOSED terms, skipping duplicates
    const created = await Promise.allSettled(
      suggestions.map((s) =>
        this.prisma.glossaryTerm.upsert({
          where: {
            termEn_domain: { termEn: s.termEn, domain: s.domain ?? domain },
          },
          create: {
            termEn: s.termEn,
            termAr: s.termAr,
            definition: s.definition,
            domain: s.domain ?? domain,
            category: s.category,
            status: TermStatus.PROPOSED,
            createdById: userId,
          },
          update: {},
        }),
      ),
    );

    return {
      suggestions,
      created: created.filter((r) => r.status === 'fulfilled').length,
      skipped: created.filter((r) => r.status === 'rejected').length,
    };
  }

  async importTerms(terms: CreateGlossaryTermDto[], userId: string) {
    const results = await Promise.allSettled(
      terms.map((t) => this.create(t, userId)),
    );

    return {
      total: terms.length,
      created: results.filter((r) => r.status === 'fulfilled').length,
      skipped: results.filter((r) => r.status === 'rejected').length,
    };
  }

  async exportTerms(format: 'json' | 'csv') {
    const terms = await this.prisma.glossaryTerm.findMany({
      where: { status: { in: [TermStatus.ACTIVE, TermStatus.PROPOSED] } },
      orderBy: { termEn: 'asc' },
      select: {
        id: true,
        termEn: true,
        termAr: true,
        definition: true,
        definitionAr: true,
        domain: true,
        category: true,
        status: true,
        source: true,
        createdAt: true,
      },
    });

    if (format === 'csv') {
      const header = 'id,termEn,termAr,definition,domain,category,status,source\n';
      const rows = terms
        .map(
          (t) =>
            `"${t.id}","${t.termEn}","${t.termAr ?? ''}","${t.definition.replace(/"/g, '""')}","${t.domain}","${t.category ?? ''}","${t.status}","${t.source ?? ''}"`,
        )
        .join('\n');
      return { format: 'csv', content: header + rows };
    }

    return { format: 'json', content: terms };
  }

  async lookup(term: string) {
    return this.prisma.glossaryTerm.findMany({
      where: {
        status: TermStatus.ACTIVE,
        OR: [
          { termEn: { contains: term, mode: 'insensitive' } },
          { termAr: { contains: term, mode: 'insensitive' } },
        ],
      },
      take: 10,
      orderBy: { isPreferred: 'desc' },
      select: {
        id: true,
        termEn: true,
        termAr: true,
        definition: true,
        definitionAr: true,
        domain: true,
        category: true,
        isPreferred: true,
      },
    });
  }
}
