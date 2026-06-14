import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JurisdictionComparisonService } from './jurisdiction-comparison.service';
import { CompareJurisdictionDto } from './dto/jurisdiction-comparison.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Jurisdiction Comparison')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller()
export class JurisdictionComparisonController {
  constructor(private readonly service: JurisdictionComparisonService) {}

  /**
   * GET /jurisdiction-profiles
   * Return the list of available jurisdiction profiles.
   */
  @Get('jurisdiction-profiles')
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
  @ApiOperation({ summary: 'List available jurisdiction profiles' })
  getJurisdictions() {
    return this.service.getJurisdictions();
  }

  /**
   * POST /legislative-items/:id/jurisdiction-comparison
   * Run a comparison with a target jurisdiction.
   */
  @Post('legislative-items/:id/jurisdiction-comparison')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
    UserRole.REVIEWER,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Compare a legislative item with a target jurisdiction' })
  async compare(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CompareJurisdictionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.compare(
      id,
      body.targetJurisdiction,
      body.referenceContext,
      body.provider,
      user.id,
    );
  }

  /**
   * GET /legislative-items/:id/jurisdiction-comparisons
   * List all jurisdiction comparisons for an item.
   */
  @Get('legislative-items/:id/jurisdiction-comparisons')
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
  @ApiOperation({ summary: 'List all jurisdiction comparisons for a legislative item' })
  async getComparisons(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getComparisons(id);
  }
}
