import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MembershipStatus } from '@rant/database';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedSocket extends Socket {
  data: { userId?: string; email?: string };
}

/**
 * Socket.IO gateway at `/realtime`.
 *
 * Auth happens once, on the handshake: the client passes its JWT access token
 * via `auth.token` (or an `Authorization` header). Connections without a valid
 * token are disconnected immediately. Clients then explicitly join org and
 * channel rooms, and every join re-checks membership — a socket can never
 * receive another tenant's events.
 *
 * This complements the existing SSE streams: SSE remains the simple one-way
 * transport (run logs, metrics, chat), while this gives the UI a single
 * bidirectional connection for the notification bell and cross-module activity.
 */
@WebSocketGateway({
  namespace: 'realtime',
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayInit {
  private readonly logger = new Logger('Realtime');

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(): void {
    this.logger.log('Socket.IO gateway ready at /realtime');
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email?: string }>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET', 'change-me-access-secret'),
      });
      if (!payload?.sub) throw new Error('missing subject');
      client.data.userId = payload.sub;
      client.data.email = payload.email;
      await client.join(`user:${payload.sub}`);
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('subscribe:org')
  async subscribeOrg(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { orgId?: string } | string,
  ): Promise<{ ok: boolean }> {
    const orgId = typeof body === 'string' ? body : body?.orgId;
    if (!orgId || !client.data.userId) return { ok: false };

    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: client.data.userId },
      },
      select: { status: true },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) return { ok: false };

    await client.join(`org:${orgId}`);
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe:org')
  async unsubscribeOrg(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { orgId?: string } | string,
  ): Promise<{ ok: boolean }> {
    const orgId = typeof body === 'string' ? body : body?.orgId;
    if (!orgId) return { ok: false };
    await client.leave(`org:${orgId}`);
    return { ok: true };
  }

  @SubscribeMessage('subscribe:channel')
  async subscribeChannel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { channelId?: string },
  ): Promise<{ ok: boolean }> {
    const channelId = body?.channelId;
    if (!channelId || !client.data.userId) return { ok: false };

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { organizationId: true },
    });
    if (!channel) return { ok: false };

    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: channel.organizationId,
          userId: client.data.userId,
        },
      },
      select: { status: true },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) return { ok: false };

    await client.join(`channel:${channelId}`);
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe:channel')
  async unsubscribeChannel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { channelId?: string },
  ): Promise<{ ok: boolean }> {
    if (!body?.channelId) return { ok: false };
    await client.leave(`channel:${body.channelId}`);
    return { ok: true };
  }

  // ── Server-side publishing (called by RealtimeBridge) ────────────────

  emitToOrg(orgId: string, event: string, payload: unknown): void {
    this.server?.to(`org:${orgId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  emitToChannel(channelId: string, event: string, payload: unknown): void {
    this.server?.to(`channel:${channelId}`).emit(event, payload);
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken) return authToken;

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);

    const query = client.handshake.query?.token;
    return typeof query === 'string' && query ? query : null;
  }
}
