import {
  Controller,
  Get,
  Post,
  Patch,
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
import { DocumentEditorService } from './document-editor.service';
import { SaveEditDto, AddCommentDto } from './dto/document-editor.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Document Editor')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('editor')
export class DocumentEditorController {
  constructor(private readonly service: DocumentEditorService) {}

  @Post(':legislativeItemId/save')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Save a document edit snapshot' })
  saveEdit(
    @Param('legislativeItemId') legislativeItemId: string,
    @Body() dto: SaveEditDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.saveEdit(legislativeItemId, dto, user.id);
  }

  @Get(':legislativeItemId/history')
  @ApiOperation({ summary: 'Get edit history for a legislative item' })
  getEditHistory(@Param('legislativeItemId') legislativeItemId: string) {
    return this.service.getEditHistory(legislativeItemId);
  }

  @Get('edits/:id')
  @ApiOperation({ summary: 'Get a single edit snapshot by ID' })
  getEditById(@Param('id') id: string) {
    return this.service.getEditById(id);
  }

  @Get(':legislativeItemId/diff')
  @ApiOperation({ summary: 'Diff two edits by ID' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  diffEdits(
    @Param('legislativeItemId') _legislativeItemId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.diffEditsByIds(from, to);
  }

  @Post(':legislativeItemId/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a comment to a legislative item' })
  addComment(
    @Param('legislativeItemId') legislativeItemId: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.addComment(legislativeItemId, dto, user.id);
  }

  @Patch('comments/:id/resolve')
  @ApiOperation({ summary: 'Resolve an editor comment' })
  resolveComment(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.resolveComment(id, user.id);
  }

  @Get(':legislativeItemId/comments')
  @ApiOperation({ summary: 'Get comments for a legislative item' })
  @ApiQuery({ name: 'includeResolved', required: false })
  getComments(
    @Param('legislativeItemId') legislativeItemId: string,
    @Query('includeResolved') includeResolved?: string,
  ) {
    return this.service.getComments(
      legislativeItemId,
      includeResolved === 'true',
    );
  }

  @Get(':legislativeItemId/numbered')
  @ApiOperation({ summary: 'Get numbered legal structure content' })
  getNumberedContent(@Param('legislativeItemId') legislativeItemId: string) {
    return this.service.getNumberedContent(legislativeItemId);
  }

  @Get(':legislativeItemId/export-text')
  @ApiOperation({ summary: 'Export document as formatted text' })
  exportAsText(@Param('legislativeItemId') legislativeItemId: string) {
    return this.service.exportAsText(legislativeItemId);
  }
}
