import { Module } from '@nestjs/common';
import { SearchFacetsService } from './search-facets.service';
import { SearchFacetsController } from './search-facets.controller';

@Module({
  controllers: [SearchFacetsController],
  providers: [SearchFacetsService],
  exports: [SearchFacetsService],
})
export class SearchFacetsModule {}
