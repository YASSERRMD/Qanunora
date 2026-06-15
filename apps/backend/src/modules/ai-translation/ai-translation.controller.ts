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
import { AiTranslationService } from './ai-translation.service';
import {
  CreateTranslationDto,
  ReviewTranslationDto,
  TranslationQueryDto,
} from './dto/ai-translation.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('AI Translation')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('ai-translation')
export class AiTranslationController {
  constructor(private readonly service: AiTranslationService) {}

  @Post('translate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Translate text using AI with legal domain context' })
  @ApiResponse({ status: 201, description: 'Translation created' })
  translate(
    @Body() dto: CreateTranslationDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.translate(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List translation requests' })
  findAll(@Query() query: TranslationQueryDto) {
    return this.service.findAll(query);
  }

  @Get('memory')
  @ApiOperation({ summary: 'Browse translation memory entries' })
  getMemoryEntries(
    @Query('sourceLang') sourceLang?: string,
    @Query('targetLang') targetLang?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.getMemoryEntries({ sourceLang, targetLang, page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get translation request by ID' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post(':id/submit-review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit translation for human review' })
  submitForReview(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.submitForReview(id, user.id);
  }

  @Patch(':id/approve')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  )
  @ApiOperation({ summary: 'Approve a translation and add to memory' })
  approve(
    @Param('id') id: string,
    @Body() dto: ReviewTranslationDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.approveTranslation(id, user.id, dto);
  }

  @Patch(':id/reject')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  )
  @ApiOperation({ summary: 'Reject a translation' })
  reject(
    @Param('id') id: string,
    @Body() dto: ReviewTranslationDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.rejectTranslation(id, user.id, dto);
  }

  @Post('legislative-item/:itemId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Translate a legislative item title and description' })
  translateLegislativeItem(
    @Param('itemId') itemId: string,
    @Query('targetLang') targetLang: string = 'en',
    @CurrentUser() user: { id: string },
  ) {
    return this.service.translateLegislativeItem(itemId, targetLang, user.id);
  }
}
