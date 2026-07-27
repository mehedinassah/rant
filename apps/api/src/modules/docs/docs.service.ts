import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Workspace } from '@rant/database';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateDocDto, UpdateDocDto } from './dto/doc.dto';

const AUTHOR_SELECT = { select: { id: true, name: true, avatarUrl: true } };

const DOC_INCLUDE = {
  author: AUTHOR_SELECT,
  lastEditedBy: AUTHOR_SELECT,
  _count: { select: { revisions: true, children: true } },
};

@Injectable()
export class DocsService {
  private readonly logger = new Logger('Docs');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async assertWorkspace(orgId: string, workspaceId: string): Promise<Workspace> {
    const ws = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, organizationId: orgId },
    });
    if (!ws) throw new NotFoundException('Workspace not found');
    return ws;
  }

  private async assertDoc(orgId: string, workspaceId: string, docId: string) {
    await this.assertWorkspace(orgId, workspaceId);
    const doc = await this.prisma.doc.findFirst({ where: { id: docId, workspaceId } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  /** Would setting `newParentId` as parent of `docId` create a cycle? */
  private async wouldCycle(docId: string, newParentId: string): Promise<boolean> {
    let cursor: string | null = newParentId;
    while (cursor) {
      if (cursor === docId) return true;
      const parent: { parentId: string | null } | null = await this.prisma.doc.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
    return false;
  }

  // ── Reading ───────────────────────────────────────────────

  /** Flat list of page summaries for the sidebar tree (client assembles it). */
  async list(orgId: string, workspaceId: string) {
    await this.assertWorkspace(orgId, workspaceId);
    return this.prisma.doc.findMany({
      where: { workspaceId, isArchived: false },
      select: {
        id: true,
        title: true,
        icon: true,
        parentId: true,
        position: true,
        updatedAt: true,
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findDoc(orgId: string, workspaceId: string, docId: string) {
    await this.assertWorkspace(orgId, workspaceId);
    const doc = await this.prisma.doc.findFirst({
      where: { id: docId, workspaceId },
      include: DOC_INCLUDE,
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  // ── Writing ───────────────────────────────────────────────

  async create(orgId: string, workspaceId: string, actorId: string, dto: CreateDocDto) {
    await this.assertWorkspace(orgId, workspaceId);
    if (dto.parentId) {
      const parent = await this.prisma.doc.findFirst({
        where: { id: dto.parentId, workspaceId },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('parentId does not belong to this workspace');
    }

    const siblings = await this.prisma.doc.count({
      where: { workspaceId, parentId: dto.parentId ?? null },
    });

    const doc = await this.prisma.doc.create({
      data: {
        workspaceId,
        parentId: dto.parentId ?? null,
        title: dto.title,
        content: dto.content ?? '',
        icon: dto.icon,
        position: siblings,
        authorId: actorId,
        lastEditedById: actorId,
      },
      include: DOC_INCLUDE,
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'doc.created',
      targetType: 'Doc',
      targetId: doc.id,
      metadata: { title: doc.title },
    });
    return doc;
  }

  async update(
    orgId: string,
    workspaceId: string,
    docId: string,
    actorId: string,
    dto: UpdateDocDto,
  ) {
    const current = await this.assertDoc(orgId, workspaceId, docId);

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === docId) throw new BadRequestException('A page cannot be its own parent');
      const parent = await this.prisma.doc.findFirst({
        where: { id: dto.parentId, workspaceId },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('parentId does not belong to this workspace');
      if (await this.wouldCycle(docId, dto.parentId)) {
        throw new BadRequestException('Cannot move a page into one of its own descendants');
      }
    }

    // Snapshot the pre-edit state whenever the title or body actually changes.
    const contentChanged = dto.content !== undefined && dto.content !== current.content;
    const titleChanged = dto.title !== undefined && dto.title !== current.title;
    if (contentChanged || titleChanged) {
      await this.prisma.docRevision.create({
        data: {
          docId,
          title: current.title,
          content: current.content,
          editedById: current.lastEditedById ?? current.authorId,
        },
      });
    }

    const doc = await this.prisma.doc.update({
      where: { id: docId },
      data: {
        title: dto.title,
        content: dto.content,
        icon: dto.icon,
        position: dto.position,
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(contentChanged || titleChanged ? { lastEditedById: actorId } : {}),
      },
      include: DOC_INCLUDE,
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'doc.updated',
      targetType: 'Doc',
      targetId: docId,
    });
    return doc;
  }

  async remove(orgId: string, workspaceId: string, docId: string, actorId: string) {
    await this.assertDoc(orgId, workspaceId, docId);
    // Children cascade via the schema relation.
    await this.prisma.doc.delete({ where: { id: docId } });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'doc.deleted',
      targetType: 'Doc',
      targetId: docId,
    });
    return { success: true };
  }

  // ── Revisions ─────────────────────────────────────────────

  async listRevisions(orgId: string, workspaceId: string, docId: string) {
    await this.assertDoc(orgId, workspaceId, docId);
    return this.prisma.docRevision.findMany({
      where: { docId },
      select: {
        id: true,
        title: true,
        editedBy: AUTHOR_SELECT,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getRevision(orgId: string, workspaceId: string, docId: string, revisionId: string) {
    await this.assertDoc(orgId, workspaceId, docId);
    const rev = await this.prisma.docRevision.findFirst({
      where: { id: revisionId, docId },
      include: { editedBy: AUTHOR_SELECT },
    });
    if (!rev) throw new NotFoundException('Revision not found');
    return rev;
  }

  /** Restore a past revision — snapshots the current state first, so it's reversible. */
  async restoreRevision(
    orgId: string,
    workspaceId: string,
    docId: string,
    revisionId: string,
    actorId: string,
  ) {
    const current = await this.assertDoc(orgId, workspaceId, docId);
    const rev = await this.prisma.docRevision.findFirst({ where: { id: revisionId, docId } });
    if (!rev) throw new NotFoundException('Revision not found');

    await this.prisma.docRevision.create({
      data: {
        docId,
        title: current.title,
        content: current.content,
        editedById: current.lastEditedById ?? current.authorId,
      },
    });
    const doc = await this.prisma.doc.update({
      where: { id: docId },
      data: { title: rev.title, content: rev.content, lastEditedById: actorId },
      include: DOC_INCLUDE,
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'doc.restored',
      targetType: 'Doc',
      targetId: docId,
      metadata: { revisionId },
    });
    return doc;
  }

  // ── Ripple: auto-draft a postmortem for a critical incident ─

  async draftPostmortem(input: {
    orgId: string;
    workspaceId: string;
    authorId: string;
    incidentTitle: string;
    repoName: string;
    environmentName: string;
  }): Promise<string | null> {
    try {
      const siblings = await this.prisma.doc.count({
        where: { workspaceId: input.workspaceId, parentId: null },
      });
      const content = [
        `# Postmortem: ${input.incidentTitle}`,
        '',
        `**Repository:** ${input.repoName}`,
        `**Environment:** ${input.environmentName}`,
        `**Status:** draft — auto-created by monitoring`,
        '',
        '## Summary',
        '_What happened, in one paragraph._',
        '',
        '## Impact',
        '_Who/what was affected and for how long._',
        '',
        '## Timeline',
        '- **Detected:** _time_',
        '- **Mitigated:** _time_',
        '- **Resolved:** _time_',
        '',
        '## Root cause',
        '_The underlying reason._',
        '',
        '## Action items',
        '- [ ] _Follow-up_',
      ].join('\n');

      const doc = await this.prisma.doc.create({
        data: {
          workspaceId: input.workspaceId,
          title: `Postmortem: ${input.incidentTitle}`,
          content,
          icon: '🚑',
          position: siblings,
          authorId: input.authorId,
          lastEditedById: input.authorId,
        },
      });
      await this.audit.record({
        organizationId: input.orgId,
        action: 'doc.postmortem_drafted',
        targetType: 'Doc',
        targetId: doc.id,
        metadata: { incident: input.incidentTitle },
      });
      this.logger.log(`🚑 drafted postmortem "${doc.title}"`);
      return doc.id;
    } catch (err) {
      this.logger.error(`failed to draft postmortem: ${String(err)}`);
      return null;
    }
  }
}
