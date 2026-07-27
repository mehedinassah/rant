import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  IncidentOpenedPayload,
  MonitorEvent,
} from '../../common/events/app-events';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DocsService } from './docs.service';

/**
 * Documentation as a bus consumer: a CRITICAL incident auto-drafts a postmortem
 * page in the workspace behind the affected repo — the same "ripple" idea as
 * the incident that files a bug issue, but for the knowledge base.
 */
@Injectable()
export class DocsListeners {
  private readonly logger = new Logger('DocTriggers');

  constructor(
    private readonly prisma: PrismaService,
    private readonly docs: DocsService,
  ) {}

  @OnEvent(MonitorEvent.IncidentOpened)
  async onIncidentOpened(p: IncidentOpenedPayload) {
    if (p.severity !== 'CRITICAL') return;

    const repo = await this.prisma.repository.findUnique({
      where: { id: p.repoId },
      select: {
        name: true,
        project: { select: { workspaceId: true } },
        organization: { select: { ownerId: true } },
      },
    });
    const workspaceId = repo?.project?.workspaceId;
    if (!workspaceId || !repo) return; // no linked workspace → nothing to write to

    const env = await this.prisma.environment.findUnique({
      where: { id: p.environmentId },
      select: { name: true },
    });

    const docId = await this.docs.draftPostmortem({
      orgId: p.orgId,
      workspaceId,
      authorId: repo.organization.ownerId,
      incidentTitle: p.title,
      repoName: repo.name,
      environmentName: env?.name ?? 'production',
    });
    if (docId) this.logger.log(`postmortem ${docId} for incident ${p.incidentId}`);
  }
}
