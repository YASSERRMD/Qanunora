import { Controller, Get, Param, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { KnowledgeGraphService } from './knowledge-graph.service';

class GraphFiltersQuery {
  ministryId?: string;
  type?: string;
  status?: string;
}

@Controller('knowledge-graph')
export class KnowledgeGraphController {
  constructor(private readonly graphService: KnowledgeGraphService) {}

  @Get()
  buildGraph(@Query() query: GraphFiltersQuery) {
    return this.graphService.buildGraph(query);
  }

  @Get('node/:type/:id')
  getNodeDetail(
    @Param('type') type: string,
    @Param('id') id: string,
  ) {
    return this.graphService.getNodeDetail(id, type);
  }

  @Get('neighbors/:type/:id')
  getNeighbors(
    @Param('type') type: string,
    @Param('id') id: string,
    @Query('depth', new DefaultValuePipe(1), ParseIntPipe) depth: number,
  ) {
    const safeDepth = depth === 2 ? 2 : 1;
    return this.graphService.getNeighbors(id, type, safeDepth);
  }
}
