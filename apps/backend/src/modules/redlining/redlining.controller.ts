import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { RedlineStatus } from '@prisma/client';
import { RedliningService } from './redlining.service';
import { ProposeRedlineDto, ReviewRedlineDto } from './dto/redlining.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Redlining')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('redline')
export class RedliningController {
  constructor(private readonly service: RedliningService) {}

  @Post(':legislativeItemId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Propose a redline change' })
  proposeChange(
    @Param('legislativeItemId') legislativeItemId: string,
    @Body() dto: ProposeRedlineDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.proposeChange(legislativeItemId, dto, user.id);
  }

  @Get(':legislativeItemId')
  @ApiOperation({ summary: 'List all redline changes for a legislative item' })
  @ApiQuery({ name: 'status', enum: RedlineStatus, required: false })
  findAll(
    @Param('legislativeItemId') legislativeItemId: string,
    @Query('status') status?: RedlineStatus,
  ) {
    return this.service.findAll(legislativeItemId, status);
  }

  @Get('change/:id')
  @ApiOperation({ summary: 'Get a redline change by ID' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch('change/:id/accept')
  @ApiOperation({ summary: 'Accept a redline change' })
  acceptChange(
    @Param('id') id: string,
    @Body() dto: ReviewRedlineDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.acceptChange(id, user.id, dto);
  }

  @Patch('change/:id/reject')
  @ApiOperation({ summary: 'Reject a redline change' })
  rejectChange(
    @Param('id') id: string,
    @Body() dto: ReviewRedlineDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.rejectChange(id, user.id, dto);
  }

  @Delete('change/:id/withdraw')
  @ApiOperation({ summary: 'Withdraw a redline change (proposer only)' })
  withdrawChange(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.withdrawChange(id, user.id);
  }

  @Get(':legislativeItemId/stats')
  @ApiOperation({ summary: 'Get redline statistics for a legislative item' })
  getStats(@Param('legislativeItemId') legislativeItemId: string) {
    return this.service.getRedlineStats(legislativeItemId);
  }

  @Post(':legislativeItemId/apply-accepted')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk-apply all accepted changes' })
  applyAllAccepted(
    @Param('legislativeItemId') legislativeItemId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.applyAllAccepted(legislativeItemId, user.id);
  }
}
