import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
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
import { AmendmentsService } from './amendments.service';
import {
  CreateAmendmentDto,
  UpdateAmendmentDto,
  AmendmentQueryDto,
} from './dto/amendment.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Amendments')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller()
export class AmendmentsController {
  constructor(private readonly service: AmendmentsService) {}

  @Post('legislative-items/:itemId/amendments')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  )
  @ApiOperation({ summary: 'Propose an amendment for a legislative item' })
  @ApiResponse({ status: 201, description: 'Created' })
  create(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: CreateAmendmentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.create(itemId, dto, user.id);
  }

  @Get('legislative-items/:itemId/amendments')
  @ApiOperation({ summary: 'List amendments for a legislative item' })
  findAll(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query() query: AmendmentQueryDto,
  ) {
    return this.service.findAll(itemId, query);
  }

  @Get('amendments/:id')
  @ApiOperation({ summary: 'Get amendment by ID' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch('amendments/:id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
    UserRole.DRAFTING_OFFICER,
  )
  @ApiOperation({ summary: 'Update a proposed amendment' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAmendmentDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post('amendments/:id/approve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN, UserRole.MINISTRY_LEGAL_OFFICER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve an amendment under review' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.approve(id, user.id);
  }

  @Post('amendments/:id/reject')
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN, UserRole.MINISTRY_LEGAL_OFFICER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject an amendment' })
  reject(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reject(id);
  }

  @Post('amendments/:id/incorporate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark an approved amendment as incorporated' })
  incorporate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.incorporate(id);
  }
}
