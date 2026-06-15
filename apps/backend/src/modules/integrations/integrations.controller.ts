import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { IntegrationsService } from './integrations.service';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
  CreateWebhookDto,
  UpdateWebhookDto,
} from './dto/integrations.dto';

interface AuthRequest {
  user: { id: string };
}

@Controller('integrations')
@UseGuards(RolesGuard)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @Roles('SUPER_ADMIN')
  listIntegrations() {
    return this.integrationsService.listIntegrations();
  }

  @Post()
  @Roles('SUPER_ADMIN')
  createIntegration(@Body() dto: CreateIntegrationDto, @Req() req: AuthRequest) {
    return this.integrationsService.createIntegration(dto, req.user.id);
  }

  @Get('logs')
  @Roles('SUPER_ADMIN')
  getLogs(@Query('integrationId') integrationId?: string, @Query('limit') limit?: string) {
    return this.integrationsService.getLogs(integrationId, limit ? parseInt(limit) : 50);
  }

  @Post('logs/:id/retry')
  @Roles('SUPER_ADMIN')
  retryFailedOutbound(@Param('id') id: string) {
    return this.integrationsService.retryFailedOutbound(id);
  }

  @Get('inbound')
  @Roles('SUPER_ADMIN')
  getInboundWebhooks(@Query('processed') processed?: string) {
    const processedBool = processed !== undefined ? processed === 'true' : undefined;
    return this.integrationsService.getInboundWebhooks(processedBool);
  }

  @Post('inbound/:source')
  @Public()
  receiveInbound(
    @Param('source') source: string,
    @Body() body: { eventType?: string; [key: string]: unknown },
    @Headers() headers: Record<string, string>,
  ) {
    const { eventType = 'unknown', ...payload } = body;
    return this.integrationsService.receiveInboundWebhook(source, eventType, payload, headers);
  }

  @Post('inbound-process/:id')
  @Roles('SUPER_ADMIN')
  processInbound(@Param('id') id: string) {
    return this.integrationsService.processInboundWebhook(id);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN')
  getIntegration(@Param('id') id: string) {
    return this.integrationsService.getIntegration(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  updateIntegration(@Param('id') id: string, @Body() dto: UpdateIntegrationDto) {
    return this.integrationsService.updateIntegration(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  deleteIntegration(@Param('id') id: string) {
    return this.integrationsService.deleteIntegration(id);
  }

  @Get(':id/webhooks')
  @Roles('SUPER_ADMIN')
  listWebhooks(@Param('id') id: string) {
    return this.integrationsService.listWebhooks(id);
  }

  @Post(':id/webhooks')
  @Roles('SUPER_ADMIN')
  createWebhook(@Param('id') id: string, @Body() dto: CreateWebhookDto) {
    return this.integrationsService.createWebhook(id, dto);
  }

  @Patch('webhooks/:id')
  @Roles('SUPER_ADMIN')
  updateWebhook(@Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.integrationsService.updateWebhook(id, dto);
  }

  @Delete('webhooks/:id')
  @Roles('SUPER_ADMIN')
  deleteWebhook(@Param('id') id: string) {
    return this.integrationsService.deleteWebhook(id);
  }
}
