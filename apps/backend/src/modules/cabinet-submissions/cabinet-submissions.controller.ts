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
import { SubmissionStatus } from '@prisma/client';
import { CabinetSubmissionsService } from './cabinet-submissions.service';
import { CreateCabinetSubmissionDto } from './dto/create-cabinet-submission.dto';
import { UpdateCabinetSubmissionDto } from './dto/update-cabinet-submission.dto';
import { CompleteChecklistItemDto } from './dto/complete-checklist-item.dto';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class ReturnSubmissionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  notes: string;
}

@ApiTags('Cabinet Submissions')
@ApiBearerAuth()
@Controller('cabinet-submissions')
export class CabinetSubmissionsController {
  constructor(private readonly submissionsService: CabinetSubmissionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a cabinet submission package' })
  create(
    @Body() dto: CreateCabinetSubmissionDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.submissionsService.create(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List cabinet submissions' })
  @ApiQuery({ name: 'status', enum: SubmissionStatus, required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('status') status?: SubmissionStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.submissionsService.findAll({
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get cabinet submission detail with checklist' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.submissionsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update cabinet submission details' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCabinetSubmissionDto,
  ) {
    return this.submissionsService.update(id, dto);
  }

  @Get(':id/completion')
  @ApiOperation({ summary: 'Get checklist completion percentage' })
  getCompletion(@Param('id', ParseUUIDPipe) id: string) {
    return this.submissionsService.getCompletionPercentage(id).then((p) => ({ percentage: p }));
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Get full package summary for export' })
  getSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.submissionsService.buildPackageSummary(id);
  }

  @Patch(':id/checklist/:itemId/complete')
  @ApiOperation({ summary: 'Mark a checklist item as complete' })
  completeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: CompleteChecklistItemDto,
    @Request() req: { user: { userId: string } },
  ) {
    return this.submissionsService.completeChecklistItem(id, itemId, req.user.userId, dto);
  }

  @Patch(':id/checklist/:itemId/uncomplete')
  @ApiOperation({ summary: 'Mark a checklist item as incomplete' })
  uncompleteItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.submissionsService.uncompleteChecklistItem(id, itemId);
  }

  @Patch(':id/submit')
  @ApiOperation({ summary: 'Submit for approval (requires 80% checklist completion)' })
  submitForApproval(@Param('id', ParseUUIDPipe) id: string) {
    return this.submissionsService.submitForApproval(id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve the submission' })
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.submissionsService.approve(id);
  }

  @Patch(':id/return')
  @ApiOperation({ summary: 'Return the submission with notes' })
  returnSubmission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnSubmissionDto,
  ) {
    return this.submissionsService.returnSubmission(id, dto.notes);
  }
}
