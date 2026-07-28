import { Injectable, NotFoundException } from '@nestjs/common';
import { CopilotRole, Prisma } from '@rant/database';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CopilotEngine } from './copilot.engine';

export const COPILOT_SUGGESTIONS = [
  "What's broken right now?",
  'What shipped this week?',
  'What should I work on?',
  'Give me a summary',
];

@Injectable()
export class CopilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: CopilotEngine,
  ) {}

  suggestions() {
    return COPILOT_SUGGESTIONS;
  }

  listConversations(orgId: string, userId: string) {
    return this.prisma.copilotConversation.findMany({
      where: { organizationId: orgId, userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }

  async getConversation(orgId: string, userId: string, id: string) {
    const conversation = await this.prisma.copilotConversation.findFirst({
      where: { id, organizationId: orgId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async deleteConversation(orgId: string, userId: string, id: string) {
    const conversation = await this.prisma.copilotConversation.findFirst({
      where: { id, organizationId: orgId, userId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.prisma.copilotConversation.delete({ where: { id } });
    return { success: true };
  }

  /** Ask a question — appends to an existing conversation or starts a new one. */
  async ask(orgId: string, userId: string, message: string, conversationId?: string) {
    let convoId = conversationId;

    if (convoId) {
      const existing = await this.prisma.copilotConversation.findFirst({
        where: { id: convoId, organizationId: orgId, userId },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException('Conversation not found');
    } else {
      const created = await this.prisma.copilotConversation.create({
        data: {
          organizationId: orgId,
          userId,
          title: message.length > 60 ? `${message.slice(0, 57)}…` : message,
        },
      });
      convoId = created.id;
    }

    await this.prisma.copilotMessage.create({
      data: { conversationId: convoId, role: CopilotRole.USER, content: message },
    });

    const reply = await this.engine.respond(orgId, userId, message);

    const assistant = await this.prisma.copilotMessage.create({
      data: {
        conversationId: convoId,
        role: CopilotRole.ASSISTANT,
        content: reply.content,
        citations: reply.citations as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.copilotConversation.update({
      where: { id: convoId },
      data: { updatedAt: new Date() },
    });

    return { conversationId: convoId, message: assistant };
  }
}
