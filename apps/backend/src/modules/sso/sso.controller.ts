import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SsoService } from './sso.service';
import {
  CreateProviderDto,
  UpdateProviderDto,
  CreateGroupMappingDto,
  JitProvisionDto,
  SimulateJitDto,
} from './dto/sso.dto';

interface AuthRequest {
  user: { id: string };
}

@Controller('sso')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN')
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Get('providers')
  listProviders() {
    return this.ssoService.listProviders();
  }

  @Post('providers')
  createProvider(@Body() dto: CreateProviderDto, @Req() req: AuthRequest) {
    return this.ssoService.createProvider(dto, req.user.id);
  }

  @Patch('providers/:id')
  updateProvider(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.ssoService.updateProvider(id, dto);
  }

  @Delete('providers/:id')
  deleteProvider(@Param('id') id: string) {
    return this.ssoService.deleteProvider(id);
  }

  @Patch('providers/:id/activate')
  activateProvider(@Param('id') id: string) {
    return this.ssoService.activateProvider(id);
  }

  @Patch('providers/:id/deactivate')
  deactivateProvider(@Param('id') id: string) {
    return this.ssoService.deactivateProvider(id);
  }

  @Get('providers/:id/group-mappings')
  getGroupMappings(@Param('id') id: string) {
    return this.ssoService.getGroupMappings(id);
  }

  @Post('providers/:id/group-mappings')
  createGroupMapping(@Param('id') id: string, @Body() dto: CreateGroupMappingDto) {
    return this.ssoService.createGroupMapping(id, dto);
  }

  @Delete('group-mappings/:id')
  deleteGroupMapping(@Param('id') id: string) {
    return this.ssoService.deleteGroupMapping(id);
  }

  @Post('jit')
  jitProvision(@Body() dto: JitProvisionDto) {
    return this.ssoService.jitProvision(dto);
  }

  @Post('jit/simulate')
  simulateJit(@Body() dto: SimulateJitDto) {
    return this.ssoService.simulateJit(dto);
  }
}
