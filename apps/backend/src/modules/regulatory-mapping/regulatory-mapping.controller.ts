import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RegulatoryMappingService } from './regulatory-mapping.service';
import { DetectRegulationsDto, CreateReferenceDto } from './dto/regulatory-mapping.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Regulatory Mapping')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller()
export class RegulatoryMappingController {
  constructor(private readonly service: RegulatoryMappingService) {}

  /**
   * POST /legislative-items/:id/regulatory-mapping/detect
   * AI-detect affected regulations.
   */
  @Post('legislative-items/:id/regulatory-mapping/detect')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
    UserRole.REVIEWER,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'AI detect affected regulations for a legislative item' })
  async detectRegulations(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DetectRegulationsDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.detectAffectedRegulations(id, body.existingLaws, body.provider, user.id);
  }

  /**
   * GET /legislative-items/:id/regulatory-references
   * List all regulatory references for an item.
   */
  @Get('legislative-items/:id/regulatory-references')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
    UserRole.REVIEWER,
    UserRole.COMMITTEE_MEMBER,
    UserRole.AUDITOR,
    UserRole.VIEWER,
  )
  @ApiOperation({ summary: 'List all regulatory references for a legislative item' })
  async findAll(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findAll(id);
  }

  /**
   * POST /legislative-items/:id/regulatory-references
   * Manually add a regulatory reference.
   */
  @Post('legislative-items/:id/regulatory-references')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
    UserRole.REVIEWER,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Manually add a regulatory reference' })
  async createReference(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateReferenceDto,
  ) {
    return this.service.createReference(id, body);
  }

  /**
   * DELETE /regulatory-references/:id
   * Delete a regulatory reference.
   */
  @Delete('regulatory-references/:id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  )
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a regulatory reference' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.delete(id);
  }

  /**
   * GET /legislative-items/:id/dependency-graph
   * Get nodes and edges for dependency graph visualization.
   */
  @Get('legislative-items/:id/dependency-graph')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
    UserRole.REVIEWER,
    UserRole.COMMITTEE_MEMBER,
    UserRole.AUDITOR,
    UserRole.VIEWER,
  )
  @ApiOperation({ summary: 'Get dependency graph for a legislative item' })
  async getDependencyGraph(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getDependencyGraph(id);
  }
}
