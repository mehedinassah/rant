import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ChatMessageKind } from '@rant/database';
import { interval, map, Observable, startWith, switchMap } from 'rxjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateChannelDto } from './dto/chat.dto';

const AUTHOR_SELECT = { select: { id: true, name: true, avatarUrl: true } };
const SYSTEM_CHANNEL = 'activity';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ensures an org has its default #general and system #activity channels. */
  private async ensureDefaults(orgId: string): Promise<void> {
    const count = await this.prisma.channel.count({ where: { organizationId: orgId } });
    if (count > 0) return;
    await this.prisma.channel.createMany({
      data: [
        { organizationId: orgId, name: 'general', topic: 'Team-wide chat' },
        { organizationId: orgId, name: SYSTEM_CHANNEL, topic: 'Automated activity feed', isSystem: true },
      ],
    });
  }

  async listChannels(orgId: string) {
    await this.ensureDefaults(orgId);
    return this.prisma.channel.findMany({
      where: { organizationId: orgId },
      orderBy: [{ isSystem: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createChannel(orgId: string, dto: CreateChannelDto) {
    const clash = await this.prisma.channel.findUnique({
      where: { organizationId_name: { organizationId: orgId, name: dto.name } },
    });
    if (clash) throw new ConflictException('A channel with that name already exists');
    return this.prisma.channel.create({
      data: { organizationId: orgId, name: dto.name, topic: dto.topic },
    });
  }

  async assertChannel(orgId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, organizationId: orgId },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel;
  }

  async listMessages(orgId: string, channelId: string) {
    await this.assertChannel(orgId, channelId);
    const messages = await this.prisma.chatMessage.findMany({
      where: { channelId },
      include: { author: AUTHOR_SELECT },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return messages.reverse();
  }

  async postMessage(orgId: string, channelId: string, authorId: string, body: string) {
    await this.assertChannel(orgId, channelId);
    return this.prisma.chatMessage.create({
      data: { channelId, authorId, kind: ChatMessageKind.USER, body },
      include: { author: AUTHOR_SELECT },
    });
  }

  /** Integration hook: post a SYSTEM message into the org's activity channel. */
  async postSystem(orgId: string, body: string): Promise<void> {
    await this.ensureDefaults(orgId);
    const channel = await this.prisma.channel.findUnique({
      where: { organizationId_name: { organizationId: orgId, name: SYSTEM_CHANNEL } },
      select: { id: true },
    });
    if (!channel) return;
    await this.prisma.chatMessage.create({
      data: { channelId: channel.id, kind: ChatMessageKind.SYSTEM, body },
    });
  }

  /** SSE: emit the channel's latest messages every 2s for a live thread. */
  stream(orgId: string, channelId: string): Observable<MessageEvent> {
    return interval(2000).pipe(
      startWith(0),
      switchMap(() => this.listMessages(orgId, channelId)),
      map((messages) => ({ data: { messages } }) as MessageEvent),
    );
  }
}
