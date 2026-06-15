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
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DecisionStatus } from '@prisma/client';
import { DecisionRegisterService } from './decision-register.service';
import { CreateDecisionDto } from './dto/create-decision.dto';
import { UpdateDecisionDto } from './dto/update-decision.dto';
import { AddDecisionLinkDto } from './dto/add-decision-link.dto';

@ApiTags('Decision Register')
@ApiBearerAuth()
@Controller('decisions')
export class DecisionRegisterController {
  constructor(private readonly decisionsService: DecisionRegisterService) {}

  @Post()
  @ApiOperation({ summary: 'Create a decision record' })
  create(
    @Body() dto: CreateDecisionDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.decisionsService.create(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List decision records with optional filters' })
  @ApiQuery({ name: 'status', enum: DecisionStatus, required: false })
  @ApiQuery({ name: 'ownerId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('status') status?: DecisionStatus,
    @Query('ownerId') ownerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.decisionsService.findAll({
      status,
      ownerId,
      startDate,
      endDate,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get decision record detail' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.decisionsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a decision record' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDecisionDto,
  ) {
    return this.decisionsService.update(id, dto);
  }

  @Patch(':id/supersede')
  @ApiOperation({ summary: 'Mark a decision as SUPERSEDED' })
  supersede(@Param('id', ParseUUIDPipe) id: string) {
    return this.decisionsService.supersede(id);
  }

  @Patch(':id/revoke')
  @ApiOperation({ summary: 'Revoke a decision' })
  revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.decisionsService.revoke(id);
  }

  // ─── Links ────────────────────────────────────────────────────────────────

  @Get(':id/links')
  @ApiOperation({ summary: 'Get all entity links for a decision' })
  getLinks(@Param('id', ParseUUIDPipe) id: string) {
    return this.decisionsService.getLinks(id);
  }

  @Post(':id/links')
  @ApiOperation({ summary: 'Add an entity link to a decision' })
  addLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddDecisionLinkDto,
  ) {
    return this.decisionsService.addLink(id, dto);
  }

  @Delete('links/:linkId')
  @ApiOperation({ summary: 'Remove a decision entity link' })
  removeLink(@Param('linkId', ParseUUIDPipe) linkId: string) {
    return this.decisionsService.removeLink(linkId);
  }
}
