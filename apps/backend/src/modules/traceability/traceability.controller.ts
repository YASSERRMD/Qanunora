import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { TraceabilityService } from './traceability.service';
import { CreateTraceLinkDto } from './dto/traceability.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Traceability')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller()
export class TraceabilityController {
  constructor(private readonly service: TraceabilityService) {}

  /**
   * POST /legislative-items/:id/trace-links
   * Create a trace link.
   */
  @Post('legislative-items/:id/trace-links')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
    UserRole.REVIEWER,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a trace link for a legislative item' })
  async createLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateTraceLinkDto,
  ) {
    return this.service.createLink(id, body);
  }

  /**
   * GET /legislative-items/:id/trace-links
   * List trace links, optionally filtered.
   */
  @Get('legislative-items/:id/trace-links')
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
  @ApiOperation({ summary: 'List trace links for a legislative item' })
  async getLinks(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('sourceType') sourceType?: string,
    @Query('targetType') targetType?: string,
    @Query('linkType') linkType?: string,
  ) {
    return this.service.getLinks(id, { sourceType, targetType, linkType });
  }

  /**
   * GET /legislative-items/:id/trace-graph
   * Get trace graph nodes and edges.
   */
  @Get('legislative-items/:id/trace-graph')
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
  @ApiOperation({ summary: 'Get trace graph for a legislative item' })
  async getGraph(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getGraph(id);
  }

  /**
   * GET /legislative-items/:id/audit-trail
   * Get audit log entries for a legislative item.
   */
  @Get('legislative-items/:id/audit-trail')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.AUDITOR,
  )
  @ApiOperation({ summary: 'Get audit trail for a legislative item' })
  async getAuditTrail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getAuditTrail(id);
  }

  /**
   * DELETE /trace-links/:id
   * Delete a trace link.
   */
  @Delete('trace-links/:id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  )
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a trace link' })
  async deleteLink(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.deleteLink(id);
  }
}
