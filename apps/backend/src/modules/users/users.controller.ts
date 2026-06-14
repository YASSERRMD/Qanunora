import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { UpdateUserRoleDto, UserListQueryDto } from './dto/user.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN)
  @ApiOperation({ summary: 'List all users' })
  async list(@Query() query: UserListQueryDto) {
    const { page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;
    const { data, total } = await this.users.list({ skip, take: limit, where });
    return {
      data: data.map((u) => {
        const { passwordHash: _, ...safe } = u;
        return safe;
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  me(@CurrentUser() user: { passwordHash?: string; [key: string]: unknown }) {
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.LEGISLATIVE_ADMIN)
  @ApiOperation({ summary: 'Get user by ID' })
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.users.findOrThrow(id);
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  @Patch(':id/role')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update user role (Super Admin only)' })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.users.updateRole(id, dto.role);
  }
}
