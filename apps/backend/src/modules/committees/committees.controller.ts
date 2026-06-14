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
import { CommitteesService } from './committees.service';
import {
  CreateCommitteeDto,
  UpdateCommitteeDto,
  AddMemberDto,
  CreateReviewDto,
} from './dto/committee.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Committees')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller()
export class CommitteesController {
  constructor(private readonly service: CommitteesService) {}

  @Post('committees')
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN)
  @ApiOperation({ summary: 'Create a new committee' })
  @ApiResponse({ status: 201, description: 'Created' })
  create(@Body() dto: CreateCommitteeDto) {
    return this.service.createCommittee(dto);
  }

  @Get('committees')
  @ApiOperation({ summary: 'List all committees' })
  findAll() {
    return this.service.findAll();
  }

  @Get('committees/:id')
  @ApiOperation({ summary: 'Get committee by ID' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch('committees/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN)
  @ApiOperation({ summary: 'Update a committee' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommitteeDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete('committees/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a committee' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.delete(id);
  }

  @Post('committees/:id/members')
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN)
  @ApiOperation({ summary: 'Add a member to a committee' })
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.service.addMember(id, dto);
  }

  @Delete('committees/:id/members/:userId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a member from a committee' })
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.service.removeMember(id, userId);
  }

  @Post('committees/:id/reviews')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.LEGISLATIVE_ADMIN,
    UserRole.MINISTRY_LEGAL_OFFICER,
  )
  @ApiOperation({ summary: 'Create a committee review for a legislative item' })
  createReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.service.createReview(id, dto);
  }

  @Get('legislative-items/:itemId/committee-reviews')
  @ApiOperation({ summary: 'Get all committee reviews for a legislative item' })
  findReviewsByItem(@Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.service.findReviewsByItem(itemId);
  }
}
