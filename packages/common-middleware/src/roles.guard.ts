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

/**
 * Decode (without verifying) the Bearer JWT payload. The token is issued by
 * identity-service and validated at the gateway; downstream services trust the
 * forwarded token to derive identity when the gateway has NOT injected the
 * x-user-* headers (e.g. the local nginx gateway, or an API Gateway that does
 * not map claims to headers). This keeps every service working in both setups.
 */
function decodeBearer(request: any): Partial<JwtPayload> | null {
  const auth = (request.headers?.['authorization'] ?? request.headers?.['Authorization']) as string | undefined;
  if (!auth || typeof auth !== 'string') return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const segments = match[1].split('.');
  if (segments.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')) as Partial<JwtPayload>;
  } catch {
    return null;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Prefer gateway-injected identity headers; otherwise derive from the JWT.
    let userId = request.headers['x-user-id'] as string;
    let rolesHeader = request.headers['x-user-roles'] as string;
    let email = request.headers['x-user-email'] as string;

    if (!userId || !rolesHeader) {
      const decoded = decodeBearer(request);
      if (decoded?.sub) {
        userId = decoded.sub;
        rolesHeader = (decoded.roles ?? []).join(',');
        email = decoded.email ?? '';
        request.headers['x-user-id'] = userId;
        request.headers['x-user-roles'] = rolesHeader;
        request.headers['x-user-email'] = email;
      }
    }

    const userRoles = (rolesHeader ?? '').split(',').map((r) => r.trim()).filter(Boolean);
    if (userId) {
      request.user = { sub: userId, email: email ?? '', roles: userRoles } as JwtPayload;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (!userId || userRoles.length === 0) {
      throw new ForbiddenException('Missing authentication context');
    }

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException(
        `Requires one of [${requiredRoles.join(', ')}]; user has [${userRoles.join(', ')}]`,
      );
    }

    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtPayload;
  },
);
