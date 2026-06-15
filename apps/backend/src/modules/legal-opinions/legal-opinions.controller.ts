import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OpinionStatus, Priority } from '@prisma/client';
import { LegalOpinionsService } from './legal-opinions.service';
import { CreateLegalOpinionDto } from './dto/create-legal-opinion.dto';
import { AddOpinionVersionDto } from './dto/add-opinion-version.dto';
import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class AssignOpinionDto {
  @ApiProperty()
  @IsUUID()
  assigneeId: string;
}

@ApiTags('Legal Opinions')
@ApiBearerAuth()
@Controller('legal-opinions')
export class LegalOpinionsController {
  constructor(private readonly opinionService: LegalOpinionsService) {}

  @Post()
  @ApiOperation({ summary: 'Request a new legal opinion' })
  create(
    @Body() dto: CreateLegalOpinionDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.opinionService.create(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List legal opinions with optional filters' })
  @ApiQuery({ name: 'status', enum: OpinionStatus, required: false })
  @ApiQuery({ name: 'assignedToId', required: false })
  @ApiQuery({ name: 'priority', enum: Priority, required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('status') status?: OpinionStatus,
    @Query('assignedToId') assignedToId?: string,
    @Query('priority') priority?: Priority,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.opinionService.findAll({
      status,
      assignedToId,
      priority,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get legal opinion detail with version history' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.opinionService.findById(id);
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign legal opinion to a user' })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignOpinionDto,
  ) {
    return this.opinionService.assign(id, dto.assigneeId);
  }

  @Post(':id/versions')
  @ApiOperation({ summary: 'Add a new version/draft to a legal opinion' })
  addVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddOpinionVersionDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.opinionService.addVersion(id, dto, req.user.userId);
  }

  @Patch(':id/versions/:versionId/approve')
  @ApiOperation({ summary: 'Approve a specific version of a legal opinion' })
  approveVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.opinionService.approveVersion(id, versionId, req.user.userId);
  }

  @Patch(':id/issue')
  @ApiOperation({ summary: 'Issue an approved legal opinion' })
  issue(@Param('id', ParseUUIDPipe) id: string) {
    return this.opinionService.issue(id);
  }

  @Patch(':id/withdraw')
  @ApiOperation({ summary: 'Withdraw a legal opinion' })
  withdraw(@Param('id', ParseUUIDPipe) id: string) {
    return this.opinionService.withdraw(id);
  }
}
