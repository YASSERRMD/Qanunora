import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

class UpdateSettingDto {
  @ApiProperty()
  value: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

class UpdateWorkflowConfigDto {
  @ApiProperty()
  config: Record<string, unknown>;
}

class CreateMinistryDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

class UpdateMinistryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  @Get('settings')
  @ApiOperation({ summary: 'Get all system settings (SUPER_ADMIN)' })
  getAllSettings() {
    return this.adminService.getAllSettings();
  }

  @Get('settings/public')
  @Public()
  @ApiOperation({ summary: 'Get public system settings (no auth required)' })
  getPublicSettings() {
    return this.adminService.getPublicSettings();
  }

  @Get('settings/:key')
  @ApiOperation({ summary: 'Get a specific system setting by key' })
  getSetting(@Param('key') key: string) {
    return this.adminService.getSetting(key);
  }

  @Put('settings/:key')
  @ApiOperation({ summary: 'Create or update a system setting' })
  updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.adminService.updateSetting(key, dto.value, dto.description);
  }

  // -------------------------------------------------------------------------
  // Workflow Configuration
  // -------------------------------------------------------------------------

  @Get('workflow-config')
  @ApiOperation({ summary: 'Get workflow configuration settings' })
  getWorkflowConfig() {
    return this.adminService.getWorkflowConfig();
  }

  @Put('workflow-config')
  @ApiOperation({ summary: 'Update workflow configuration settings' })
  updateWorkflowConfig(@Body() dto: UpdateWorkflowConfigDto) {
    return this.adminService.updateWorkflowConfig(dto.config);
  }

  // -------------------------------------------------------------------------
  // AI Providers
  // -------------------------------------------------------------------------

  @Get('ai-providers')
  @ApiOperation({ summary: 'Get AI provider configuration (keys masked)' })
  getAiProviderConfig() {
    return this.adminService.getAiProviderConfig();
  }

  @Put('ai-providers/:provider')
  @ApiOperation({ summary: 'Update AI provider model/settings (not API keys)' })
  updateAiProviderConfig(
    @Param('provider') provider: string,
    @Body() config: Record<string, unknown>,
  ) {
    return this.adminService.updateAiProviderConfig(provider, config);
  }

  // -------------------------------------------------------------------------
  // Ministries
  // -------------------------------------------------------------------------

  @Get('ministries')
  @ApiOperation({ summary: 'List all ministries' })
  getMinistries() {
    return this.adminService.getMinistries();
  }

  @Post('ministries')
  @ApiOperation({ summary: 'Create a new ministry' })
  createMinistry(@Body() dto: CreateMinistryDto) {
    return this.adminService.createMinistry(dto);
  }

  @Patch('ministries/:id')
  @ApiOperation({ summary: 'Update a ministry' })
  updateMinistry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMinistryDto,
  ) {
    return this.adminService.updateMinistry(id, dto);
  }

  // -------------------------------------------------------------------------
  // Security Settings
  // -------------------------------------------------------------------------

  @Get('security')
  @ApiOperation({ summary: 'Get security configuration settings' })
  getSecuritySettings() {
    return this.adminService.getSecuritySettings();
  }

  @Put('security')
  @ApiOperation({ summary: 'Update security configuration settings' })
  updateSecuritySettings(@Body() dto: Record<string, unknown>) {
    return this.adminService.updateSecuritySettings(dto);
  }
}
