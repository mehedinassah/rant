import { SetMetadata } from '@nestjs/common';
import { OrgRole } from '@rant/database';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to members holding one of the given org roles.
 * OWNER and ADMIN are always permitted by the RolesGuard, so list only
 * the *additional* roles that should have access.
 */
export const Roles = (...roles: OrgRole[]) => SetMetadata(ROLES_KEY, roles);
