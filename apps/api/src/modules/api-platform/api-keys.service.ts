import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { generateApiKey } from '../../common/api-key.util';
import { CreateApiKeyDto } from './dto/api-platform.dto';

const KEY_SELECT = {
  id: true,
  name: true,
  prefix: true,
  lastUsedAt: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
};

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(orgId: string) {
    return this.prisma.apiKey.findMany({
      where: { organizationId: orgId },
      select: KEY_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Creates a key and returns the raw secret exactly once. */
  async create(orgId: string, actorId: string, dto: CreateApiKeyDto) {
    const { key, prefix, hash } = generateApiKey();
    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 86_400_000)
      : null;

    const created = await this.prisma.apiKey.create({
      data: {
        organizationId: orgId,
        userId: actorId,
        name: dto.name,
        prefix,
        keyHash: hash,
        expiresAt,
      },
      select: KEY_SELECT,
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'api_key.created',
      targetType: 'ApiKey',
      targetId: created.id,
      metadata: { name: dto.name, prefix },
    });

    // `key` is the only time the raw secret is ever exposed.
    return { ...created, key };
  }

  async revoke(orgId: string, actorId: string, keyId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, organizationId: orgId },
    });
    if (!key) throw new NotFoundException('API key not found');
    if (!key.revokedAt) {
      await this.prisma.apiKey.update({
        where: { id: keyId },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'api_key.revoked',
      targetType: 'ApiKey',
      targetId: keyId,
    });
    return { success: true };
  }
}
