import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
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
import { LegalStructureService } from './legal-structure.service';
import {
  CreateLegalStructureDto,
  UpdateLegalStructureDto,
  ReorderLegalStructureDto,
} from './dto/legal-structure.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Legal Structure')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller()
export class LegalStructureController {
  constructor(private readonly service: LegalStructureService) {}

  @Get('legislative-items/:itemId/structure')
  @ApiOperation({ summary: 'Get hierarchical legal structure for a legislative item' })
  getTree(@Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.service.getTree(itemId);
  }

  @Post('legislative-items/:itemId/structure')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  )
  @ApiOperation({ summary: 'Add a structural element (chapter, section, article, clause)' })
  @ApiResponse({ status: 201, description: 'Created' })
  create(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: CreateLegalStructureDto,
  ) {
    return this.service.create(itemId, dto);
  }

  @Post('legislative-items/:itemId/structure/reorder')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder structural elements within a legislative item' })
  reorder(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: ReorderLegalStructureDto,
  ) {
    return this.service.reorder(itemId, dto.items);
  }

  @Patch('structure/:id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  )
  @ApiOperation({ summary: 'Update a structural element' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLegalStructureDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete('structure/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a structural element' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.delete(id);
  }
}
