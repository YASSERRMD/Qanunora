import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@ApiTags('Organization')
@ApiBearerAuth()
@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  // -------------------------------------------------------------------------
  // Hierarchy overview
  // -------------------------------------------------------------------------

  @Get('hierarchy')
  @ApiOperation({ summary: 'Full organization hierarchy: ministries → departments → units' })
  getHierarchy() {
    return this.organizationService.getHierarchy();
  }

  // -------------------------------------------------------------------------
  // Departments
  // -------------------------------------------------------------------------

  @Get('departments')
  @ApiOperation({ summary: 'List departments, optionally filtered by ministryId' })
  @ApiQuery({ name: 'ministryId', required: false })
  findAllDepartments(@Query('ministryId') ministryId?: string) {
    return this.organizationService.findAllDepartments(ministryId);
  }

  @Post('departments')
  @ApiOperation({ summary: 'Create a department under a ministry' })
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.organizationService.createDepartment(dto);
  }

  @Get('departments/:id')
  @ApiOperation({ summary: 'Get department by ID with children and units' })
  findDepartment(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.findDepartmentById(id);
  }

  @Patch('departments/:id')
  @ApiOperation({ summary: 'Update department' })
  updateDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.organizationService.updateDepartment(id, dto);
  }

  @Delete('departments/:id')
  @ApiOperation({ summary: 'Delete department' })
  removeDepartment(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.removeDepartment(id);
  }

  @Get('departments/:id/tree')
  @ApiOperation({ summary: 'Get department subtree for a ministry' })
  getDepartmentTree(@Param('id') ministryId: string) {
    return this.organizationService.getDepartmentTree(ministryId);
  }

  // -------------------------------------------------------------------------
  // Units
  // -------------------------------------------------------------------------

  @Get('units')
  @ApiOperation({ summary: 'List units, optionally filtered by departmentId' })
  @ApiQuery({ name: 'departmentId', required: false })
  findAllUnits(@Query('departmentId') departmentId?: string) {
    return this.organizationService.findAllUnits(departmentId);
  }

  @Post('units')
  @ApiOperation({ summary: 'Create a unit under a department' })
  createUnit(@Body() dto: CreateUnitDto) {
    return this.organizationService.createUnit(dto);
  }

  @Get('units/:id')
  @ApiOperation({ summary: 'Get unit by ID' })
  findUnit(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.findUnitById(id);
  }

  @Patch('units/:id')
  @ApiOperation({ summary: 'Update unit' })
  updateUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnitDto,
  ) {
    return this.organizationService.updateUnit(id, dto);
  }

  @Delete('units/:id')
  @ApiOperation({ summary: 'Delete unit' })
  removeUnit(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.removeUnit(id);
  }
}
