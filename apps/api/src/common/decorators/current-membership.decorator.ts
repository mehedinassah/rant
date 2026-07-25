import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { OrganizationMembership } from '@rant/database';

/** Injects the membership resolved by RolesGuard for the current org route. */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OrganizationMembership => {
    const request = ctx.switchToHttp().getRequest<{ membership: OrganizationMembership }>();
    return request.membership;
  },
);
