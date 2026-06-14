import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { StakeholdersService } from './stakeholders.service';
import {
  CreateStakeholderDto,
  UpdateStakeholderDto,
  StakeholderQueryDto,
  LogCommunicationDto,
} from './dto/stakeholder.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Stakeholders')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('stakeholders')
export class StakeholdersController {
  constructor(private readonly service: StakeholdersService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
  )
  @ApiOperation({ summary: 'Create a new stakeholder' })
  @ApiResponse({ status: 201, description: 'Created' })
  create(@Body() dto: CreateStakeholderDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List stakeholders with type filter and search' })
  findAll(@Query() query: StakeholderQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get stakeholder by ID' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
  )
  @ApiOperation({ summary: 'Update a stakeholder' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStakeholderDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a stakeholder' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.delete(id);
  }

  @Post(':id/communications')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  )
  @ApiOperation({ summary: 'Log a communication with a stakeholder' })
  logCommunication(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LogCommunicationDto,
  ) {
    return this.service.logCommunication(id, dto);
  }

  @Get(':id/communications')
  @ApiOperation({ summary: 'Get communication logs for a stakeholder' })
  getCommunicationLogs(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getCommunicationLogs(id);
  }
}
