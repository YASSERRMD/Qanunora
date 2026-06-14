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
import { LegislativeService } from './legislative.service';
import {
  CreateLegislativeItemDto,
  UpdateLegislativeItemDto,
  LegislativeItemQueryDto,
} from './dto/legislative.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Legislative Items')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('legislative-items')
export class LegislativeController {
  constructor(private readonly service: LegislativeService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  )
  @ApiOperation({ summary: 'Create a new legislative item' })
  @ApiResponse({ status: 201, description: 'Created' })
  create(
    @Body() dto: CreateLegislativeItemDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List legislative items with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list' })
  findAll(@Query() query: LegislativeItemQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get legislative item by ID' })
  @ApiResponse({ status: 200, description: 'Item detail' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  )
  @ApiOperation({ summary: 'Update a legislative item' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLegislativeItemDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a legislative item (admin only)' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.delete(id);
  }
}
