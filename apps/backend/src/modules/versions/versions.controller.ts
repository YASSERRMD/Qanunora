import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { VersionsService } from './versions.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class CreateVersionDto {
  label?: string;
  notes?: string;
  documentId?: string;
  contentSnapshot?: Record<string, unknown>;
}

@ApiTags('Versions')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller()
export class VersionsController {
  constructor(private readonly service: VersionsService) {}

  @Post('legislative-items/:itemId/versions')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  )
  @ApiOperation({ summary: 'Create a new version snapshot for a legislative item' })
  createVersion(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: CreateVersionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.createVersion({
      legislativeItemId: itemId,
      documentId: dto.documentId,
      label: dto.label,
      notes: dto.notes,
      contentSnapshot: dto.contentSnapshot,
      createdById: user.id,
    });
  }

  @Get('legislative-items/:itemId/versions')
  @ApiOperation({ summary: 'Get all versions for a legislative item' })
  findAll(@Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.service.findAll(itemId);
  }

  @Get('versions/:id')
  @ApiOperation({ summary: 'Get a specific version by ID' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Post('legislative-items/:itemId/versions/restore/:versionId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  )
  @ApiOperation({ summary: 'Restore a legislative item to a previous version' })
  restoreVersion(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.restoreVersion(itemId, versionId, user.id);
  }

  @Get('versions/compare')
  @ApiOperation({ summary: 'Compare two versions by ID' })
  @ApiQuery({ name: 'v1', type: String, description: 'First version ID' })
  @ApiQuery({ name: 'v2', type: String, description: 'Second version ID' })
  compareVersions(
    @Query('v1') v1: string,
    @Query('v2') v2: string,
  ) {
    return this.service.compareVersions(v1, v2);
  }
}
