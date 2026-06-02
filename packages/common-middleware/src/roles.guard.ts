import { Injectable, CanActivate, ExecutionContext, SetMetadata, ForbiddenException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  iat: number;
  exp: number;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-user-id'] as string;
    const rolesHeader = request.headers['x-user-roles'] as string;

    if (!userId || !rolesHeader) {
      throw new ForbiddenException('Missing authentication context');
    }

    const userRoles = rolesHeader.split(',').map((r) => r.trim());
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `Requires one of [${requiredRoles.join(', ')}]; user has [${userRoles.join(', ')}]`,
      );
    }

    request.user = { sub: userId, roles: userRoles } as JwtPayload;
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtPayload;
  },
);
