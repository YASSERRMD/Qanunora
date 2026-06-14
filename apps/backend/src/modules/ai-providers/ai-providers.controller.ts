import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AiProviderRegistry } from './ai-provider.registry';
import { AiProviderFactory } from './ai-provider.factory';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

class TestProviderDto {
  provider!: string;
}

@ApiTags('AI Providers')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('ai-providers')
export class AiProvidersController {
  constructor(
    private readonly registry: AiProviderRegistry,
    private readonly factory: AiProviderFactory,
  ) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN)
  @ApiOperation({ summary: 'List all registered AI providers' })
  listProviders(): { providers: string[]; default: string } {
    let defaultProvider = 'unknown';
    try {
      defaultProvider = this.registry.getDefault().name;
    } catch {
      // no default configured
    }
    return {
      providers: this.registry.list(),
      default: defaultProvider,
    };
  }

  @Get('default')
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN)
  @ApiOperation({ summary: 'Get the default AI provider name' })
  getDefault(): { provider: string; configured: boolean } {
    try {
      const provider = this.registry.getDefault();
      return { provider: provider.name, configured: provider.isConfigured() };
    } catch {
      return { provider: 'none', configured: false };
    }
  }

  @Post('test')
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test a specific AI provider with a ping message' })
  async testProvider(
    @Body() body: TestProviderDto,
  ): Promise<{ success: boolean; provider: string; configured: boolean; response?: string; error?: string }> {
    const provider = this.factory.getProvider(body.provider);

    if (!provider.isConfigured()) {
      return {
        success: false,
        provider: provider.name,
        configured: false,
        error: 'Provider is not configured (missing API key or endpoint)',
      };
    }

    try {
      const result = await provider.complete({
        messages: [
          {
            role: 'user',
            content: 'Reply with exactly: {"status":"ok"}',
          },
        ],
        maxTokens: 20,
        temperature: 0,
      });
      return {
        success: true,
        provider: provider.name,
        configured: true,
        response: result.content,
      };
    } catch (error: unknown) {
      return {
        success: false,
        provider: provider.name,
        configured: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
