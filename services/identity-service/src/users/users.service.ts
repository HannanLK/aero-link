import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20) {
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, email: true, firstName: true, lastName: true, roles: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, roles: true, createdAt: true },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async update(id: string, dto: UpdateUserDto, requesterId: string) {
    if (requesterId !== id) throw new ForbiddenException('Can only update your own profile');
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: { id: true, email: true, firstName: true, lastName: true, phone: true },
    });
  }

  async assignRole(id: string, dto: AssignRoleDto) {
    const user = await this.findOne(id);
    const roles = Array.from(new Set([...user.roles, dto.role as UserRole]));
    return this.prisma.user.update({ where: { id }, data: { roles }, select: { id: true, roles: true } });
  }

  async removeRole(id: string, role: string) {
    const user = await this.findOne(id);
    const roles = user.roles.filter((r) => r !== role);
    return this.prisma.user.update({ where: { id }, data: { roles }, select: { id: true, roles: true } });
  }
}
