import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClassificationService } from './classification.service';
import { ClassifyDto, DeclassifyDto, GrantAccessExceptionDto } from './dto/classification.dto';

interface AuthRequest {
  user: { id: string };
}

@Controller('classification')
@UseGuards(RolesGuard)
export class ClassificationController {
  constructor(private readonly classificationService: ClassificationService) {}

  @Post(':legislativeItemId')
  @Roles('LEGISLATIVE_ADMIN', 'SUPER_ADMIN')
  classify(
    @Param('legislativeItemId') legislativeItemId: string,
    @Body() dto: ClassifyDto,
    @Req() req: AuthRequest,
  ) {
    return this.classificationService.classify(legislativeItemId, dto, req.user.id);
  }

  @Delete(':legislativeItemId/declassify')
  @Roles('SUPER_ADMIN')
  declassify(
    @Param('legislativeItemId') legislativeItemId: string,
    @Body() dto: DeclassifyDto,
    @Req() req: AuthRequest,
  ) {
    return this.classificationService.declassify(legislativeItemId, dto, req.user.id);
  }

  @Get(':legislativeItemId')
  @Roles('VIEWER', 'REVIEWER', 'COMMITTEE_MEMBER', 'MINISTRY_LEGAL_OFFICER', 'DRAFTING_OFFICER', 'STAKEHOLDER_MANAGER', 'PUBLIC_CONSULTATION_OFFICER', 'AUDITOR', 'LEGISLATIVE_ADMIN', 'SUPER_ADMIN')
  getClassification(@Param('legislativeItemId') legislativeItemId: string) {
    return this.classificationService.getClassification(legislativeItemId);
  }

  @Post(':legislativeItemId/detect')
  @Roles('LEGISLATIVE_ADMIN', 'SUPER_ADMIN')
  detectSensitive(@Param('legislativeItemId') legislativeItemId: string, @Req() req: AuthRequest) {
    return this.classificationService.detectSensitiveContent(legislativeItemId);
  }

  @Post('exceptions')
  @Roles('SUPER_ADMIN')
  grantException(@Body() dto: GrantAccessExceptionDto, @Req() req: AuthRequest) {
    return this.classificationService.grantAccessException(dto, req.user.id);
  }

  @Delete('exceptions/:id')
  @Roles('SUPER_ADMIN')
  revokeException(@Param('id') id: string) {
    return this.classificationService.revokeAccessException(id);
  }

  @Get('pending-review')
  @Roles('AUDITOR', 'SUPER_ADMIN')
  getPendingReview() {
    return this.classificationService.getPendingDeclassificationReview();
  }

  @Get('stats')
  @Roles('AUDITOR', 'LEGISLATIVE_ADMIN', 'SUPER_ADMIN')
  getStats() {
    return this.classificationService.getClassificationStats();
  }
}
