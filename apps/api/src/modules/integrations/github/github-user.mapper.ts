import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export interface GithubActor {
  id?: number | null;
  login?: string | null;
  avatarUrl?: string | null;
}

const GHOST_EMAIL = 'ghost@github.rant.local';

/**
 * Resolves a GitHub actor to a rant User id. Prefers an explicit account link
 * (by GitHub id, else by login); falls back to a shared, inactive "GitHub"
 * ghost user so foreign keys always resolve for unmapped contributors.
 */
@Injectable()
export class GithubUserMapper {
  private ghostId: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async resolveUserId(actor: GithubActor | null | undefined): Promise<string> {
    if (actor?.id != null) {
      const link = await this.prisma.githubAccountLink.findUnique({
        where: { githubId: BigInt(actor.id) },
        select: { userId: true },
      });
      if (link) return link.userId;
    }
    if (actor?.login) {
      const link = await this.prisma.githubAccountLink.findFirst({
        where: { login: actor.login },
        select: { userId: true },
      });
      if (link) return link.userId;
    }
    return this.ghostUserId();
  }

  private async ghostUserId(): Promise<string> {
    if (this.ghostId) return this.ghostId;
    const existing = await this.prisma.user.findUnique({
      where: { email: GHOST_EMAIL },
      select: { id: true },
    });
    if (existing) {
      this.ghostId = existing.id;
      return existing.id;
    }
    const created = await this.prisma.user.create({
      data: {
        email: GHOST_EMAIL,
        name: 'GitHub',
        passwordHash: '!', // unusable — this account can never log in
        isActive: false,
      },
      select: { id: true },
    });
    this.ghostId = created.id;
    return created.id;
  }
}
