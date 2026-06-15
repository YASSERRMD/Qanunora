import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { IntegrationsService } from '../integrations.service';
import { PrismaService } from '../../database/prisma.service';

const INTEGRATION = {
  id: 'int-1',
  name: 'Test API',
  description: 'Test integration',
  baseUrl: 'https://api.example.com',
  authType: 'API_KEY',
  authConfig: { encrypted: 'PLACEHOLDER' },
  headers: {},
  isActive: true,
  createdById: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { webhooks: 0, integrationLogs: 0 },
};

const WEBHOOK = {
  id: 'wh-1',
  integrationId: 'int-1',
  eventType: 'legislative_item.published',
  targetUrl: 'https://receiver.example.com/hook',
  secret: null,
  isActive: true,
  maxRetries: 3,
  lastTriggeredAt: null,
  createdAt: new Date(),
};

const LOG = {
  id: 'log-1',
  integrationId: 'int-1',
  eventType: 'legislative_item.published',
  direction: 'OUTBOUND',
  payload: {},
  success: false,
  retryCount: 1,
  targetUrl: 'https://receiver.example.com/hook',
  createdAt: new Date(),
  integration: { name: 'Test API' },
};

const INBOUND = {
  id: 'inb-1',
  source: 'external-system',
  eventType: 'data.updated',
  payload: {},
  headers: {},
  processed: false,
  processedAt: null,
  errorMessage: null,
  createdAt: new Date(),
};

function makePrisma() {
  return {
    externalIntegration: {
      create: jest.fn().mockResolvedValue(INTEGRATION),
      findMany: jest.fn().mockResolvedValue([INTEGRATION]),
      findUnique: jest.fn().mockResolvedValue({ ...INTEGRATION, webhooks: [] }),
      update: jest.fn().mockImplementation((args: { data: unknown }) => Promise.resolve({ ...INTEGRATION, ...args.data as object })),
      delete: jest.fn().mockResolvedValue(INTEGRATION),
    },
    webhookSubscription: {
      create: jest.fn().mockResolvedValue(WEBHOOK),
      findMany: jest.fn().mockResolvedValue([WEBHOOK]),
      findFirst: jest.fn().mockResolvedValue(WEBHOOK),
      update: jest.fn().mockImplementation((args: { data: unknown }) => Promise.resolve({ ...WEBHOOK, ...args.data as object })),
      delete: jest.fn().mockResolvedValue(WEBHOOK),
    },
    integrationLog: {
      create: jest.fn().mockResolvedValue(LOG),
      findMany: jest.fn().mockResolvedValue([LOG]),
      findUnique: jest.fn().mockResolvedValue(LOG),
    },
    inboundWebhook: {
      create: jest.fn().mockResolvedValue(INBOUND),
      findMany: jest.fn().mockResolvedValue([INBOUND]),
      update: jest.fn().mockImplementation((args: { data: unknown }) => Promise.resolve({ ...INBOUND, ...args.data as object })),
    },
  };
}

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let mockPrisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    mockPrisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [IntegrationsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<IntegrationsService>(IntegrationsService);
  });

  describe('createIntegration', () => {
    it('encrypts authConfig and creates integration', async () => {
      const result = await service.createIntegration(
        { name: 'Test API', baseUrl: 'https://api.example.com', authConfig: { apiKey: 'secret' } },
        'user-1',
      );
      expect(result.name).toBe('Test API');
      const call = (mockPrisma.externalIntegration.create as jest.Mock).mock.calls[0][0];
      expect(call.data.authConfig).toHaveProperty('encrypted');
    });
  });

  describe('listIntegrations', () => {
    it('masks authConfig for all integrations', async () => {
      const integrations = await service.listIntegrations();
      expect(integrations).toHaveLength(1);
      expect(integrations[0].authConfig).toEqual({ encrypted: true });
    });
  });

  describe('getIntegration', () => {
    it('throws NotFoundException for unknown integration', async () => {
      mockPrisma.externalIntegration.findUnique.mockResolvedValue(null);
      await expect(service.getIntegration('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns integration with masked credentials', async () => {
      const result = await service.getIntegration('int-1');
      expect(result).toBeDefined();
      expect(result.id).toBe('int-1');
    });
  });

  describe('createWebhook', () => {
    it('encrypts secret and creates webhook', async () => {
      const result = await service.createWebhook('int-1', {
        eventType: 'legislative_item.published',
        targetUrl: 'https://receiver.example.com/hook',
        secret: 'my-secret',
      });
      expect(result.eventType).toBe('legislative_item.published');
      const call = (mockPrisma.webhookSubscription.create as jest.Mock).mock.calls[0][0];
      // Secret should be encrypted (not plain text)
      expect(call.data.secret).not.toBe('my-secret');
    });

    it('stores null when no secret provided', async () => {
      await service.createWebhook('int-1', {
        eventType: 'test.event',
        targetUrl: 'https://example.com/hook',
      });
      const call = (mockPrisma.webhookSubscription.create as jest.Mock).mock.calls[0][0];
      expect(call.data.secret).toBeNull();
    });
  });

  describe('listWebhooks', () => {
    it('returns webhooks for integration', async () => {
      const result = await service.listWebhooks('int-1');
      expect(result).toHaveLength(1);
      expect(result[0].integrationId).toBe('int-1');
    });
  });

  describe('deleteWebhook', () => {
    it('deletes webhook by id', async () => {
      await service.deleteWebhook('wh-1');
      expect(mockPrisma.webhookSubscription.delete).toHaveBeenCalledWith({ where: { id: 'wh-1' } });
    });
  });

  describe('receiveInboundWebhook', () => {
    it('stores inbound webhook entry', async () => {
      const result = await service.receiveInboundWebhook(
        'external-system',
        'data.updated',
        { field: 'value' },
        { 'content-type': 'application/json' },
      );
      expect(result.source).toBe('external-system');
      expect(mockPrisma.inboundWebhook.create).toHaveBeenCalled();
    });
  });

  describe('getInboundWebhooks', () => {
    it('returns all inbound webhooks when no filter', async () => {
      const result = await service.getInboundWebhooks();
      expect(result).toHaveLength(1);
    });

    it('filters by processed status', async () => {
      await service.getInboundWebhooks(false);
      expect(mockPrisma.inboundWebhook.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { processed: false } }),
      );
    });
  });

  describe('processInboundWebhook', () => {
    it('marks webhook as processed', async () => {
      await service.processInboundWebhook('inb-1');
      expect(mockPrisma.inboundWebhook.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ processed: true }) }),
      );
    });
  });

  describe('getLogs', () => {
    it('returns logs with optional integration filter', async () => {
      const result = await service.getLogs('int-1', 10);
      expect(result).toHaveLength(1);
      expect(mockPrisma.integrationLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { integrationId: 'int-1' }, take: 10 }),
      );
    });
  });

  describe('retryFailedOutbound', () => {
    it('throws NotFoundException when log not found', async () => {
      mockPrisma.integrationLog.findUnique.mockResolvedValue(null);
      await expect(service.retryFailedOutbound('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteIntegration', () => {
    it('deletes integration by id', async () => {
      await service.deleteIntegration('int-1');
      expect(mockPrisma.externalIntegration.delete).toHaveBeenCalledWith({ where: { id: 'int-1' } });
    });
  });
});
