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
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { GlossaryService } from './glossary.service';
import {
  CreateGlossaryTermDto,
  UpdateGlossaryTermDto,
  GlossaryQueryDto,
  SuggestTermsDto,
  ImportTermsDto,
} from './dto/glossary.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Glossary')
@Controller('glossary')
export class GlossaryController {
  constructor(private readonly service: GlossaryService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'List glossary terms with search and filters' })
  findAll(@Query() query: GlossaryQueryDto) {
    return this.service.findAll(query);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new glossary term' })
  create(
    @Body() dto: CreateGlossaryTermDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.create(dto, user.id);
  }

  @Get('export')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Export glossary terms as JSON or CSV' })
  exportTerms(@Query('format') format: 'json' | 'csv' = 'json') {
    return this.service.exportTerms(format);
  }

  @Post('suggest')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'AI-suggest glossary terms from legal text' })
  suggestTerm(
    @Body() dto: SuggestTermsDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.suggestTerm(dto, user.id);
  }

  @Post('import')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Bulk import glossary terms' })
  importTerms(
    @Body() dto: ImportTermsDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.importTerms(dto.terms, user.id);
  }

  @Get('lookup/:term')
  @Public()
  @ApiOperation({ summary: 'Public lookup of a glossary term by name' })
  @ApiResponse({ status: 200, description: 'Matching terms' })
  lookup(@Param('term') term: string) {
    return this.service.lookup(term);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get glossary term by ID' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  )
  @ApiOperation({ summary: 'Update a glossary term' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGlossaryTermDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
  )
  @ApiOperation({ summary: 'Deprecate a glossary term' })
  deprecate(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.deprecate(id, user.id);
  }
}
