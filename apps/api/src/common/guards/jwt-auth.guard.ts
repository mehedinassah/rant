import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { hashApiKey, looksLikeApiKey } from '../api-key.util';
import type { AuthUser } from '../decorators/current-user.decorator';

interface GuardedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
  apiKey?: { id: string; organizationId: string };
}

/**
 * Primary authentication guard. Requests may present either a JWT
 * (`Authorization: Bearer <jwt>`) or an API key (`X-API-Key` header, or a
 * `Bearer rant_…` token). An API key authenticates as its creating user, so
 * every downstream RBAC check behaves identically to an interactive session.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<GuardedRequest>();
    const token = this.extractApiKey(req);
    if (token) return this.authenticateApiKey(token, req);

    return super.canActivate(context);
  }

  private extractApiKey(req: GuardedRequest): string | undefined {
    const header = req.headers['x-api-key'];
    if (typeof header === 'string' && looksLikeApiKey(header)) return header;
    const auth = req.headers['authorization'];
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      const t = auth.slice(7);
      if (looksLikeApiKey(t)) return t;
    }
    return undefined;
  }

  private async authenticateApiKey(token: string, req: GuardedRequest): Promise<boolean> {
    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(token) },
      include: { user: { select: { email: true } } },
    });
    if (!key || key.revokedAt || (key.expiresAt && key.expiresAt.getTime() < Date.now())) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }
    req.user = { userId: key.userId, email: key.user.email };
    req.apiKey = { id: key.id, organizationId: key.organizationId };
    // Best-effort last-used stamp; never block the request on it.
    void this.prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
    return true;
  }
}
