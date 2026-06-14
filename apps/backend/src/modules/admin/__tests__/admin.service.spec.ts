import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from '../admin.service';
import { PrismaService } from '../../database/prisma.service';

const MOCK_SETTING = {
  id: 'setting-uuid-1',
  key: 'workflow.reviewDays',
  value: 7,
  description: 'Number of days for review',
  isPublic: false,
  updatedAt: new Date(),
};

function makeMockPrisma() {
  return {
    systemSetting: {
      findUnique: jest.fn().mockResolvedValue(MOCK_SETTING),
      findMany: jest.fn().mockResolvedValue([MOCK_SETTING]),
      upsert: jest.fn().mockResolvedValue({ ...MOCK_SETTING, value: 14 }),
    },
    ministry: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: 'min-1', name: 'MOJ', code: 'MOJ' }),
      create: jest.fn().mockResolvedValue({ id: 'min-new', name: 'New', code: 'NEW' }),
      update: jest.fn().mockResolvedValue({ id: 'min-1', name: 'Updated', code: 'MOJ' }),
    },
  };
}

describe('AdminService', () => {
  let service: AdminService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  // ---------------------------------------------------------------------------
  // getSetting
  // ---------------------------------------------------------------------------

  describe('getSetting', () => {
    it('returns a setting by key', async () => {
      const result = await service.getSetting('workflow.reviewDays');
      expect(result).toEqual(MOCK_SETTING);
      expect(mockPrisma.systemSetting.findUnique).toHaveBeenCalledWith({
        where: { key: 'workflow.reviewDays' },
      });
    });

    it('throws NotFoundException when setting does not exist', async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue(null);
      await expect(service.getSetting('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // updateSetting
  // ---------------------------------------------------------------------------

  describe('updateSetting', () => {
    it('upserts a setting with new value', async () => {
      const result = await service.updateSetting('workflow.reviewDays', 14, 'Updated description');
      expect(mockPrisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'workflow.reviewDays' },
          create: expect.objectContaining({
            key: 'workflow.reviewDays',
            value: 14,
          }),
          update: expect.objectContaining({
            value: 14,
          }),
        }),
      );
      expect(result.value).toBe(14);
    });

    it('upserts without description when not provided', async () => {
      await service.updateSetting('new.key', 'someValue');
      expect(mockPrisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'new.key' },
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getAiProviderConfig — API key masking
  // ---------------------------------------------------------------------------

  describe('getAiProviderConfig', () => {
    it('masks fields containing "key" in their name', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([
        { ...MOCK_SETTING, key: 'ai.openai.apiKey', value: 'sk-supersecret' },
        { ...MOCK_SETTING, key: 'ai.openai.model', value: 'gpt-4o' },
      ]);

      const result = await service.getAiProviderConfig();
      expect(result['openai.apiKey']).toBe('****');
      expect(result['openai.model']).toBe('gpt-4o');
    });

    it('masks fields containing "secret"', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([
        { ...MOCK_SETTING, key: 'ai.anthropic.clientSecret', value: 'my-secret' },
      ]);

      const result = await service.getAiProviderConfig();
      expect(result['anthropic.clientSecret']).toBe('****');
    });

    it('masks fields containing "token"', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([
        { ...MOCK_SETTING, key: 'ai.gemini.accessToken', value: 'token-value' },
      ]);

      const result = await service.getAiProviderConfig();
      expect(result['gemini.accessToken']).toBe('****');
    });

    it('does not mask non-sensitive fields', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([
        { ...MOCK_SETTING, key: 'ai.openai.model', value: 'gpt-4o' },
        { ...MOCK_SETTING, key: 'ai.openai.temperature', value: 0.7 },
      ]);

      const result = await service.getAiProviderConfig();
      expect(result['openai.model']).toBe('gpt-4o');
      expect(result['openai.temperature']).toBe(0.7);
    });
  });

  // ---------------------------------------------------------------------------
  // updateAiProviderConfig — must not store API keys
  // ---------------------------------------------------------------------------

  describe('updateAiProviderConfig', () => {
    it('saves non-sensitive fields to database', async () => {
      await service.updateAiProviderConfig('openai', { model: 'gpt-4o' });
      expect(mockPrisma.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { key: 'ai.openai.model' } }),
      );
    });

    it('does not call upsert for API key fields', async () => {
      await service.updateAiProviderConfig('openai', { apiKey: 'sk-test', model: 'gpt-4o' });
      // upsert should be called only for 'model', not 'apiKey'
      const calledKeys = mockPrisma.systemSetting.upsert.mock.calls.map(
        (call: [{ where: { key: string } }]) => call[0].where.key,
      );
      expect(calledKeys).toContain('ai.openai.model');
      expect(calledKeys).not.toContain('ai.openai.apiKey');
    });

    it('returns updated:false for skipped API key fields', async () => {
      const result = await service.updateAiProviderConfig('openai', { apiKey: 'sk-test' });
      const skipped = result.updated.find((u) => u.key === 'ai.openai.apiKey');
      expect(skipped?.updated).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // getAllSettings
  // ---------------------------------------------------------------------------

  describe('getAllSettings', () => {
    it('returns all settings ordered by key', async () => {
      const result = await service.getAllSettings();
      expect(Array.isArray(result)).toBe(true);
      expect(mockPrisma.systemSetting.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { key: 'asc' } }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getPublicSettings
  // ---------------------------------------------------------------------------

  describe('getPublicSettings', () => {
    it('queries only public settings', async () => {
      await service.getPublicSettings();
      expect(mockPrisma.systemSetting.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublic: true },
        }),
      );
    });
  });
});
