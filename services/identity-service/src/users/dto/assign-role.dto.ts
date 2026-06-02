import { IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class AssignRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}
