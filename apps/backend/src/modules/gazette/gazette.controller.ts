import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GazetteService } from './gazette.service';
import { UpdateGazetteDto, RetractGazetteDto } from './dto/gazette.dto';

interface AuthRequest {
  user: { id: string };
}

@Controller('gazette')
@UseGuards(RolesGuard)
export class GazetteController {
  constructor(private readonly gazetteService: GazetteService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'LEGISLATIVE_ADMIN')
  createEntry(@Body('legislativeItemId') legislativeItemId: string, @Req() req: AuthRequest) {
    return this.gazetteService.createEntry(legislativeItemId, req.user.id);
  }

  @Get('archive')
  getPublishedArchive(@Query('year') year?: string, @Query('query') query?: string) {
    return this.gazetteService.getPublishedArchive(year ? parseInt(year) : undefined, query);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'LEGISLATIVE_ADMIN', 'MINISTRY_LEGAL_OFFICER', 'DRAFTING_OFFICER', 'REVIEWER', 'AUDITOR')
  listEntries(@Query('status') status?: string) {
    return this.gazetteService.listEntries(status);
  }

  @Get(':id')
  getEntry(@Param('id') id: string) {
    return this.gazetteService.getEntry(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'LEGISLATIVE_ADMIN')
  updateEntry(@Param('id') id: string, @Body() dto: UpdateGazetteDto) {
    return this.gazetteService.updateEntry(id, dto);
  }

  @Post(':id/checklist/:itemId/complete')
  @Roles('SUPER_ADMIN', 'LEGISLATIVE_ADMIN', 'MINISTRY_LEGAL_OFFICER', 'DRAFTING_OFFICER')
  completeChecklistItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.gazetteService.completeChecklistItem(id, itemId);
  }

  @Post(':id/checklist/:itemId/uncomplete')
  @Roles('SUPER_ADMIN', 'LEGISLATIVE_ADMIN')
  uncompleteChecklistItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.gazetteService.uncompleteChecklistItem(id, itemId);
  }

  @Post(':id/submit')
  @Roles('SUPER_ADMIN', 'LEGISLATIVE_ADMIN', 'MINISTRY_LEGAL_OFFICER')
  submitForApproval(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.gazetteService.submitForApproval(id, req.user.id);
  }

  @Post(':id/approve')
  @Roles('SUPER_ADMIN', 'LEGISLATIVE_ADMIN')
  approve(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.gazetteService.approve(id, req.user.id);
  }

  @Post(':id/publish')
  @Roles('SUPER_ADMIN', 'LEGISLATIVE_ADMIN')
  publish(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.gazetteService.publish(id, req.user.id);
  }

  @Post(':id/retract')
  @Roles('SUPER_ADMIN')
  retract(@Param('id') id: string, @Req() req: AuthRequest, @Body() dto: RetractGazetteDto) {
    return this.gazetteService.retract(id, req.user.id, dto);
  }

  @Get(':id/package')
  getPublicationPackage(@Param('id') id: string) {
    return this.gazetteService.buildPublicationPackage(id);
  }
}
