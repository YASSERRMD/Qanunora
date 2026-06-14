import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { SemanticSearchService } from './semantic-search.service';
import { IndexingService } from './indexing.service';

class IndexRequestDto {
  itemId?: string;
}

@Controller()
export class SemanticSearchController {
  constructor(
    private readonly searchService: SemanticSearchService,
    private readonly indexingService: IndexingService,
  ) {}

  @Post('search/index')
  @Roles('LEGISLATIVE_ADMIN', 'SUPER_ADMIN')
  async indexContent(@Body() dto: IndexRequestDto) {
    if (dto.itemId) {
      return this.indexingService.indexLegislativeItem(dto.itemId);
    }
    return this.indexingService.indexAll();
  }

  @Get('search')
  async search(
    @Query('q') q: string = '',
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('mode') mode: 'semantic' | 'keyword' | 'hybrid' = 'hybrid',
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    if (!q || q.trim().length === 0) {
      return [];
    }

    const filters = {
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
    };

    if (mode === 'semantic') {
      return this.searchService.semanticSearch(q, limit);
    }
    if (mode === 'keyword') {
      return this.searchService.hybridSearch(q, filters, limit);
    }
    return this.searchService.hybridSearch(q, filters, limit);
  }
}
