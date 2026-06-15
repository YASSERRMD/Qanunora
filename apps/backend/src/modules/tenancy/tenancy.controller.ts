import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { TenancyService } from './tenancy.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('tenants')
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Get()
  @ApiOperation({ summary: 'List all tenants (SUPER_ADMIN)' })
  findAll() {
    return this.tenancyService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new tenant (SUPER_ADMIN)' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenancyService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by ID (SUPER_ADMIN)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenancyService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tenant (SUPER_ADMIN)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenancyService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete tenant (SUPER_ADMIN)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenancyService.remove(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get tenant stats: user count, ministry count, item count (SUPER_ADMIN)' })
  stats(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenancyService.getTenantStats(id);
  }
}
