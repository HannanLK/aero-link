import { Controller, Get, Patch, Delete, Body, Param, Query, ParseUUIDPipe, UseGuards, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { RolesGuard, Roles, CurrentUser, JwtPayload } from '@aerolink/common-middleware';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('ADMIN')
  findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.usersService.findAll(Number(page), Number(limit));
  }

  @Get(':id')
  @Roles('ADMIN', 'PASSENGER', 'GATE_AGENT', 'CHECK_IN_STAFF', 'BAGGAGE_HANDLER', 'FLIGHT_OPS')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles('PASSENGER', 'ADMIN')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.update(id, dto, user.sub);
  }

  @Patch(':id/roles')
  @Roles('ADMIN')
  assignRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRoleDto) {
    return this.usersService.assignRole(id, dto);
  }

  @Delete(':id/roles/:role')
  @Roles('ADMIN')
  removeRole(@Param('id', ParseUUIDPipe) id: string, @Param('role') role: string) {
    return this.usersService.removeRole(id, role);
  }
}
