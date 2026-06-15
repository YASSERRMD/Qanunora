import {
  Controller,
  Get,
  Post,
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
import { SearchFacetsService } from './search-facets.service';
import { SearchWithFacetsDto, SaveSearchDto } from './dto/search-facets.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Search Facets')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('search-facets')
export class SearchFacetsController {
  constructor(private readonly service: SearchFacetsService) {}

  @Get('facets')
  @ApiOperation({ summary: 'Get all facet dimension counts' })
  @ApiQuery({ name: 'query', required: false })
  getFacets(@Query('query') query?: string) {
    return this.service.getFacets(query);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search legislative items with facets' })
  searchWithFacets(@Body() dto: SearchWithFacetsDto) {
    return this.service.searchWithFacets(dto);
  }

  @Get('saved')
  @ApiOperation({ summary: "Get current user's saved searches" })
  getSavedSearches(@CurrentUser() user: { id: string }) {
    return this.service.getSavedSearches(user.id);
  }

  @Post('saved')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Save a search for the current user' })
  saveSearch(
    @Body() dto: SaveSearchDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.saveSearch(user.id, dto);
  }

  @Delete('saved/:id')
  @ApiOperation({ summary: 'Delete a saved search' })
  deleteSavedSearch(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.deleteSavedSearch(id, user.id);
  }

  @Post('saved/:id/run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run a saved search' })
  runSavedSearch(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.runSavedSearch(id, user.id);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get search analytics' })
  getSearchAnalytics(@CurrentUser() user: { id: string }) {
    return this.service.getSearchAnalytics(user.id);
  }
}
