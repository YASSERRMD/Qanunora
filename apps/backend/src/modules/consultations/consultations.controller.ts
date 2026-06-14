import {
  Controller,
  Get,
  Post,
  Patch,
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
import { ConsultationsService } from './consultations.service';
import {
  CreateConsultationDto,
  UpdateConsultationDto,
  SubmitFeedbackDto,
  ReviewFeedbackDto,
  FeedbackQueryDto,
} from './dto/consultation.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Consultations')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('consultations')
export class ConsultationsController {
  constructor(private readonly service: ConsultationsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN, UserRole.MINISTRY_LEGAL_OFFICER)
  @ApiOperation({ summary: 'Create a new public consultation' })
  @ApiResponse({ status: 201, description: 'Created' })
  create(@Body() dto: CreateConsultationDto) {
    return this.service.createConsultation(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all consultations' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get consultation by ID' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN, UserRole.MINISTRY_LEGAL_OFFICER)
  @ApiOperation({ summary: 'Update a consultation' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConsultationDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post(':id/open')
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN, UserRole.MINISTRY_LEGAL_OFFICER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Open a consultation for public feedback' })
  open(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.open(id);
  }

  @Post(':id/close')
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN, UserRole.MINISTRY_LEGAL_OFFICER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a consultation' })
  close(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.close(id);
  }

  @Post(':id/feedback')
  @ApiOperation({ summary: 'Submit feedback to an open consultation' })
  @ApiResponse({ status: 201, description: 'Feedback submitted' })
  submitFeedback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitFeedbackDto,
  ) {
    return this.service.submitFeedback(id, dto);
  }

  @Get(':id/feedback')
  @ApiOperation({ summary: 'Get feedback for a consultation' })
  getFeedback(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FeedbackQueryDto,
  ) {
    return this.service.getFeedback(id, query);
  }

  @Post(':id/feedback/:feedbackId/review')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
  )
  @ApiOperation({ summary: 'Review a piece of feedback' })
  reviewFeedback(
    @Param('feedbackId', ParseUUIDPipe) feedbackId: string,
    @Body() dto: ReviewFeedbackDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.reviewFeedback(feedbackId, dto, user.id);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Get feedback summary counts by category and sentiment' })
  getSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getSummary(id);
  }
}
