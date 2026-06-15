import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { encryptApiKey, decryptApiKey } from '../../common/utils/encryption.util';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
  CreateWebhookDto,
  UpdateWebhookDto,
} from './dto/integrations.dto';
import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Integration CRUD ──────────────────────────────────────────────────────

  async createIntegration(dto: CreateIntegrationDto, userId: string) {
    const encryptedAuthConfig = encryptApiKey(JSON.stringify(dto.authConfig ?? {}));
    return this.prisma.externalIntegration.create({
      data: {
        name: dto.name,
        description: dto.description,
        baseUrl: dto.baseUrl,
        authType: dto.authType ?? 'API_KEY',
        authConfig: { encrypted: encryptedAuthConfig },
        headers: dto.headers ?? {},
        createdById: userId,
      },
    });
  }

  async listIntegrations() {
    const integrations = await this.prisma.externalIntegration.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { webhooks: true, integrationLogs: true } } },
    });
    return integrations.map((i) => ({ ...i, authConfig: { encrypted: true } }));
  }

  async getIntegration(id: string) {
    const integration = await this.prisma.externalIntegration.findUnique({
      where: { id },
      include: { webhooks: true },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    const configBlob = integration.authConfig as { encrypted?: string };
    let authConfig: Record<string, unknown> = {};
    if (configBlob.encrypted) {
      try {
        const decrypted = decryptApiKey(configBlob.encrypted);
        const parsed = JSON.parse(decrypted) as Record<string, unknown>;
        // Mask secrets
        authConfig = Object.fromEntries(
          Object.entries(parsed).map(([k, v]) => {
            const lower = k.toLowerCase();
            if (lower.includes('secret') || lower.includes('password') || lower.includes('key') || lower.includes('token')) {
              const str = String(v);
              return [k, str.length > 8 ? `${str.slice(0, 4)}****${str.slice(-4)}` : '****'];
            }
            return [k, v];
          }),
        );
      } catch {
        authConfig = {};
      }
    }
    return { ...integration, authConfig };
  }

  async updateIntegration(id: string, dto: UpdateIntegrationDto) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data['name'] = dto.name;
    if (dto.description !== undefined) data['description'] = dto.description;
    if (dto.baseUrl !== undefined) data['baseUrl'] = dto.baseUrl;
    if (dto.authType !== undefined) data['authType'] = dto.authType;
    if (dto.headers !== undefined) data['headers'] = dto.headers;
    if (dto.isActive !== undefined) data['isActive'] = dto.isActive;
    if (dto.authConfig !== undefined) {
      data['authConfig'] = { encrypted: encryptApiKey(JSON.stringify(dto.authConfig)) };
    }
    return this.prisma.externalIntegration.update({ where: { id }, data });
  }

  async deleteIntegration(id: string) {
    return this.prisma.externalIntegration.delete({ where: { id } });
  }

  // ── Webhook Subscriptions ─────────────────────────────────────────────────

  async createWebhook(integrationId: string, dto: CreateWebhookDto) {
    const encryptedSecret = dto.secret ? encryptApiKey(dto.secret) : null;
    return this.prisma.webhookSubscription.create({
      data: {
        integrationId,
        eventType: dto.eventType,
        targetUrl: dto.targetUrl,
        secret: encryptedSecret,
        isActive: dto.isActive ?? true,
        maxRetries: dto.maxRetries ?? 3,
      },
    });
  }

  async listWebhooks(integrationId: string) {
    return this.prisma.webhookSubscription.findMany({
      where: { integrationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateWebhook(id: string, dto: UpdateWebhookDto) {
    const data: Record<string, unknown> = {};
    if (dto.eventType !== undefined) data['eventType'] = dto.eventType;
    if (dto.targetUrl !== undefined) data['targetUrl'] = dto.targetUrl;
    if (dto.isActive !== undefined) data['isActive'] = dto.isActive;
    if (dto.maxRetries !== undefined) data['maxRetries'] = dto.maxRetries;
    if (dto.secret !== undefined) data['secret'] = encryptApiKey(dto.secret);
    return this.prisma.webhookSubscription.update({ where: { id }, data });
  }

  async deleteWebhook(id: string) {
    return this.prisma.webhookSubscription.delete({ where: { id } });
  }

  // ── Outbound Event Publishing ─────────────────────────────────────────────

  async publishEvent(eventType: string, payload: Record<string, unknown>) {
    const webhooks = await this.prisma.webhookSubscription.findMany({
      where: { eventType, isActive: true },
    });

    const results: Array<{ webhookId: string; success: boolean }> = [];
    for (const webhook of webhooks) {
      const result = await this.deliverWebhook(webhook, eventType, payload, 0);
      results.push({ webhookId: webhook.id, success: result });
      await this.prisma.webhookSubscription.update({
        where: { id: webhook.id },
        data: { lastTriggeredAt: new Date() },
      });
    }
    return results;
  }

  private async deliverWebhook(
    webhook: { id: string; targetUrl: string; secret: string | null; maxRetries: number; integrationId: string },
    eventType: string,
    payload: Record<string, unknown>,
    retryCount: number,
  ): Promise<boolean> {
    const body = JSON.stringify({ eventType, payload, timestamp: new Date().toISOString() });
    const signature = this.computeHmac(webhook.secret, body);

    try {
      const { status, responseBody } = await this.httpPost(webhook.targetUrl, body, signature);
      const success = status >= 200 && status < 300;

      await this.prisma.integrationLog.create({
        data: {
          integrationId: webhook.integrationId,
          eventType,
          direction: 'OUTBOUND',
          payload: payload as never,
          responseStatus: status,
          responseBody: { body: responseBody } as never,
          success,
          retryCount,
          targetUrl: webhook.targetUrl,
        },
      });

      if (!success && retryCount < webhook.maxRetries) {
        return this.deliverWebhook(webhook, eventType, payload, retryCount + 1);
      }
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.prisma.integrationLog.create({
        data: {
          integrationId: webhook.integrationId,
          eventType,
          direction: 'OUTBOUND',
          payload: payload as never,
          success: false,
          errorMessage,
          retryCount,
          targetUrl: webhook.targetUrl,
        },
      });

      if (retryCount < webhook.maxRetries) {
        return this.deliverWebhook(webhook, eventType, payload, retryCount + 1);
      }
      return false;
    }
  }

  private computeHmac(encryptedSecret: string | null, body: string): string {
    if (!encryptedSecret) return '';
    try {
      const secret = decryptApiKey(encryptedSecret);
      return crypto.createHmac('sha256', secret).update(body).digest('hex');
    } catch {
      return '';
    }
  }

  private httpPost(url: string, body: string, signature: string): Promise<{ status: number; responseBody: string }> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const options = {
        hostname: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-Qanunora-Signature': `sha256=${signature}`,
        },
        timeout: 10000,
      };
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk.toString()));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, responseBody: data }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      req.write(body);
      req.end();
    });
  }

  // ── Inbound Webhooks ──────────────────────────────────────────────────────

  async receiveInboundWebhook(
    source: string,
    eventType: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ) {
    return this.prisma.inboundWebhook.create({
      data: { source, eventType, payload: payload as never, headers: headers as never },
    });
  }

  async getInboundWebhooks(processed?: boolean) {
    const where = processed !== undefined ? { processed } : {};
    return this.prisma.inboundWebhook.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async processInboundWebhook(id: string) {
    return this.prisma.inboundWebhook.update({
      where: { id },
      data: { processed: true, processedAt: new Date() },
    });
  }

  // ── Logs ──────────────────────────────────────────────────────────────────

  async getLogs(integrationId?: string, limit = 50) {
    const where = integrationId ? { integrationId } : {};
    return this.prisma.integrationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { integration: { select: { name: true } } },
    });
  }

  async retryFailedOutbound(logId: string) {
    const log = await this.prisma.integrationLog.findUnique({ where: { id: logId } });
    if (!log) throw new NotFoundException('Log entry not found');

    // Find a matching active webhook by targetUrl and eventType
    const webhook = await this.prisma.webhookSubscription.findFirst({
      where: {
        integrationId: log.integrationId ?? undefined,
        eventType: log.eventType,
        isActive: true,
      },
    });

    if (!webhook) {
      return { success: false, message: 'No matching active webhook found' };
    }

    const result = await this.deliverWebhook(
      webhook,
      log.eventType,
      log.payload as Record<string, unknown>,
      0,
    );
    return { success: result };
  }
}
