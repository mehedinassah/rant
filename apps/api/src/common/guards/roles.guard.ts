import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MembershipStatus, OrgRole } from '@rant/database';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../decorators/current-user.decorator';

/** Roles that may perform any org-scoped action regardless of the @Roles list. */
const ALWAYS_ALLOWED: OrgRole[] = [OrgRole.OWNER, OrgRole.ADMIN];

/**
 * Resolves the acting user's membership for the org referenced by the route
 * (`:orgId` param) and enforces the @Roles allow-list. The resolved membership
 * is attached to `req.membership` for downstream handlers.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<OrgRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest<{
      user: AuthUser;
      params: Record<string, string>;
      membership?: unknown;
    }>();

    const orgId = req.params.orgId;
    if (!orgId) {
      // Route isn't org-scoped; nothing for this guard to enforce.
      return true;
    }

    const membership = await this.prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: req.user.userId } },
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      // Don't leak org existence to non-members.
      throw new NotFoundException('Organization not found');
    }

    req.membership = membership;

    const allowed = [...ALWAYS_ALLOWED, ...(required ?? [])];
    if (!required || required.length === 0) {
      // No specific role required beyond active membership.
      return true;
    }

    if (!allowed.includes(membership.role)) {
      throw new ForbiddenException('Insufficient role for this action');
    }
    return true;
  }
}
