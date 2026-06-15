import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RegistryAdaptersService } from './registry-adapters.service';
import { CreateAdapterDto, UpdateAdapterDto } from './dto/registry-adapters.dto';

@Controller('registries')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN')
export class RegistryAdaptersController {
  constructor(private readonly registryAdaptersService: RegistryAdaptersService) {}

  @Get()
  listAdapters() {
    return this.registryAdaptersService.listAdapters();
  }

  @Post()
  createAdapter(@Body() dto: CreateAdapterDto) {
    return this.registryAdaptersService.createAdapter(dto);
  }

  @Patch(':id')
  updateAdapter(@Param('id') id: string, @Body() dto: UpdateAdapterDto) {
    return this.registryAdaptersService.updateAdapter(id, dto);
  }

  @Patch(':id/enable')
  enableAdapter(@Param('id') id: string) {
    return this.registryAdaptersService.enableAdapter(id);
  }

  @Patch(':id/disable')
  disableAdapter(@Param('id') id: string) {
    return this.registryAdaptersService.disableAdapter(id);
  }

  @Post(':id/sync')
  triggerSync(@Param('id') id: string) {
    return this.registryAdaptersService.triggerSync(id);
  }

  @Post(':id/push')
  pushToRegistry(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    return this.registryAdaptersService.pushToRegistry(id, data);
  }

  @Get(':id/logs')
  getSyncLogs(@Param('id') id: string) {
    return this.registryAdaptersService.getSyncLogs(id);
  }

  @Get('logs/all')
  getAllLogs() {
    return this.registryAdaptersService.getSyncLogs();
  }
}
