import { IsEnum } from 'class-validator';
import { UserRole } from '../../../prisma/generated/client';

export class AssignRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}
