import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { PublicPortalService } from './public-portal.service';
import { SubmitPublicFeedbackDto, PublicItemQueryDto } from './dto/submit-public-feedback.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Public Portal')
@Public()
@Controller('public')
export class PublicPortalController {
  constructor(private readonly service: PublicPortalService) {}

  @Get('bills')
  @ApiOperation({ summary: 'List published bills (public)' })
  @ApiResponse({ status: 200, description: 'Paginated list of published bills' })
  getPublishedItems(@Query() query: PublicItemQueryDto) {
    return this.service.getPublishedItems(query);
  }

  @Get('bills/:id')
  @ApiOperation({ summary: 'Get published bill detail (public)' })
  @ApiResponse({ status: 200, description: 'Bill detail' })
  @ApiResponse({ status: 404, description: 'Not found' })
  getPublishedItemDetail(@Param('id') id: string) {
    return this.service.getPublishedItemDetail(id);
  }

  @Get('consultations')
  @ApiOperation({ summary: 'List open consultations (public)' })
  @ApiResponse({ status: 200, description: 'Open consultations list' })
  getOpenConsultations() {
    return this.service.getOpenConsultations();
  }

  @Get('consultations/:id')
  @ApiOperation({ summary: 'Get consultation detail (public)' })
  @ApiResponse({ status: 200, description: 'Consultation detail' })
  @ApiResponse({ status: 404, description: 'Not found' })
  getConsultationDetail(@Param('id') id: string) {
    return this.service.getConsultationDetail(id);
  }

  @Post('consultations/:id/feedback')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit public feedback for a consultation' })
  @ApiResponse({ status: 201, description: 'Feedback submitted' })
  @ApiResponse({ status: 400, description: 'Consultation not open' })
  submitPublicFeedback(
    @Param('id') id: string,
    @Body() dto: SubmitPublicFeedbackDto,
  ) {
    return this.service.submitPublicFeedback(id, dto);
  }

  @Get('bills/:id/structure')
  @ApiOperation({ summary: 'Get published law legal structure (public)' })
  @ApiResponse({ status: 200, description: 'Legal structure tree' })
  getPublishedLegalStructure(@Param('id') id: string) {
    return this.service.getPublishedLegalStructure(id);
  }
}
