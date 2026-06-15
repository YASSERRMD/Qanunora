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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { VoteResult } from '@prisma/client';
import { VotingService } from './voting.service';
import { CreateVoteEventDto } from './dto/create-vote-event.dto';
import { RecordMemberVoteDto } from './dto/record-member-vote.dto';
import { CreateResolutionDto } from './dto/create-resolution.dto';

@ApiTags('Voting')
@ApiBearerAuth()
@Controller('votes')
export class VotingController {
  constructor(private readonly votingService: VotingService) {}

  @Post()
  @ApiOperation({ summary: 'Create a vote event' })
  create(
    @Body() dto: CreateVoteEventDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.votingService.createVoteEvent(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List vote events with optional filters' })
  @ApiQuery({ name: 'result', enum: VoteResult, required: false })
  @ApiQuery({ name: 'legislativeItemId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('result') result?: VoteResult,
    @Query('legislativeItemId') legislativeItemId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.votingService.findAll({
      result,
      legislativeItemId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vote event detail with member positions and resolution' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.votingService.findById(id);
  }

  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get vote analytics with position breakdown and percentages' })
  getAnalytics(@Param('id', ParseUUIDPipe) id: string) {
    return this.votingService.getVoteAnalytics(id);
  }

  @Post(':id/votes')
  @ApiOperation({ summary: 'Record a member vote position (upsert)' })
  recordMemberVote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordMemberVoteDto,
  ) {
    return this.votingService.recordMemberVote(id, dto);
  }

  @Patch(':id/finalize')
  @ApiOperation({ summary: 'Finalize vote and determine result' })
  finalize(@Param('id', ParseUUIDPipe) id: string) {
    return this.votingService.finalizeVote(id);
  }

  @Post(':id/resolution')
  @ApiOperation({ summary: 'Create resolution for a PASSED vote (auto-generates RES-YYYY-NNNN)' })
  createResolution(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateResolutionDto,
  ) {
    return this.votingService.createResolution(id, dto);
  }
}
