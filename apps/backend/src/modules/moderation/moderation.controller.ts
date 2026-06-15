import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
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
import { ModerationService } from './moderation.service';
import { SubmitAnonymousFeedbackDto, ModeratorActionDto } from './dto/moderation.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Moderation')
@Controller('moderation')
export class ModerationController {
  constructor(private readonly service: ModerationService) {}

  @Post('submit/:consultationId')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit anonymous feedback (public)' })
  @ApiResponse({ status: 201, description: 'Feedback queued for moderation' })
  submitAnonymousFeedback(
    @Param('consultationId') consultationId: string,
    @Body() dto: SubmitAnonymousFeedbackDto,
  ) {
    return this.service.submitAnonymousFeedback(consultationId, dto);
  }

  @Get('queue')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.PUBLIC_CONSULTATION_OFFICER,
  )
  @ApiOperation({ summary: 'Get pending moderation queue' })
  getPendingQueue(@Query('consultationId') consultationId?: string) {
    return this.service.getPendingQueue(consultationId);
  }

  @Patch(':id/approve')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.PUBLIC_CONSULTATION_OFFICER,
  )
  @ApiOperation({ summary: 'Approve a feedback submission' })
  approve(
    @Param('id') id: string,
    @Body() dto: ModeratorActionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.approve(id, user.id, dto.note);
  }

  @Patch(':id/reject')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.PUBLIC_CONSULTATION_OFFICER,
  )
  @ApiOperation({ summary: 'Reject a feedback submission' })
  reject(
    @Param('id') id: string,
    @Body() dto: ModeratorActionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.reject(id, user.id, dto.note);
  }

  @Patch(':id/flag')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.PUBLIC_CONSULTATION_OFFICER,
  )
  @ApiOperation({ summary: 'Flag a feedback submission for further review' })
  flag(
    @Param('id') id: string,
    @Body() dto: ModeratorActionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.flag(id, user.id, dto.note);
  }

  @Get('published/:consultationId')
  @Public()
  @ApiOperation({ summary: 'Get approved and published feedback (public)' })
  getPublished(@Param('consultationId') consultationId: string) {
    return this.service.getPublished(consultationId);
  }

  @Get('stats/:consultationId')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.PUBLIC_CONSULTATION_OFFICER,
    UserRole.AUDITOR,
  )
  @ApiOperation({ summary: 'Get moderation statistics for a consultation' })
  getModerationStats(@Param('consultationId') consultationId: string) {
    return this.service.getModerationStats(consultationId);
  }
}
