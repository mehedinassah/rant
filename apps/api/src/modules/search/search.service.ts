import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateSavedSearchDto } from './dto/search.dto';

export type SearchType =
  | 'issue'
  | 'project'
  | 'repository'
  | 'pull_request'
  | 'doc'
  | 'incident';

export interface SearchResult {
  type: SearchType;
  id: string;
  title: string;
  subtitle?: string;
  snippet?: string;
  linkPath: string;
}

export interface SearchGroup {
  type: SearchType;
  label: string;
  results: SearchResult[];
}

const GROUP_ORDER: { type: SearchType; label: string }[] = [
  { type: 'issue', label: 'Issues' },
  { type: 'project', label: 'Projects' },
  { type: 'repository', label: 'Repositories' },
  { type: 'pull_request', label: 'Pull requests' },
  { type: 'doc', label: 'Docs' },
  { type: 'incident', label: 'Incidents' },
];

/** Extract a short excerpt around the first case-insensitive match. */
function snippet(text: string | null | undefined, q: string): string | undefined {
  if (!text) return undefined;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text.length > 140 ? `${text.slice(0, 140)}…` : text;
  const start = Math.max(0, idx - 50);
  const end = Math.min(text.length, idx + q.length + 90);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    orgId: string,
    rawQuery: string,
    opts: { types?: SearchType[]; perType?: number } = {},
  ): Promise<{ query: string; total: number; groups: SearchGroup[] }> {
    const q = rawQuery.trim();
    if (q.length < 1) return { query: q, total: 0, groups: [] };

    const perType = Math.min(Math.max(opts.perType ?? 8, 1), 25);
    const want = (t: SearchType) => !opts.types || opts.types.includes(t);
    const ci = { contains: q, mode: 'insensitive' as const };

    const [issues, projects, repos, pulls, docs, incidents] = await Promise.all([
      want('issue')
        ? this.prisma.issue.findMany({
            where: {
              project: { workspace: { organizationId: orgId } },
              OR: [{ title: ci }, { description: ci }],
            },
            select: {
              id: true,
              number: true,
              title: true,
              description: true,
              status: true,
              project: { select: { id: true, key: true, workspaceId: true } },
            },
            take: perType,
            orderBy: { updatedAt: 'desc' },
          })
        : [],
      want('project')
        ? this.prisma.project.findMany({
            where: {
              workspace: { organizationId: orgId },
              OR: [{ name: ci }, { key: ci }, { description: ci }],
            },
            select: { id: true, name: true, key: true, description: true, status: true, workspaceId: true },
            take: perType,
          })
        : [],
      want('repository')
        ? this.prisma.repository.findMany({
            where: {
              organizationId: orgId,
              OR: [{ name: ci }, { slug: ci }, { description: ci }],
            },
            select: { id: true, name: true, slug: true, description: true },
            take: perType,
            orderBy: { updatedAt: 'desc' },
          })
        : [],
      want('pull_request')
        ? this.prisma.pullRequest.findMany({
            where: {
              repository: { organizationId: orgId },
              OR: [{ title: ci }, { description: ci }],
            },
            select: {
              id: true,
              number: true,
              title: true,
              description: true,
              status: true,
              repositoryId: true,
            },
            take: perType,
            orderBy: { updatedAt: 'desc' },
          })
        : [],
      want('doc')
        ? this.prisma.doc.findMany({
            where: {
              workspace: { organizationId: orgId },
              isArchived: false,
              OR: [{ title: ci }, { content: ci }],
            },
            select: { id: true, title: true, content: true, workspaceId: true },
            take: perType,
            orderBy: { updatedAt: 'desc' },
          })
        : [],
      want('incident')
        ? this.prisma.incident.findMany({
            where: {
              monitor: { environment: { repository: { organizationId: orgId } } },
              OR: [{ title: ci }, { summary: ci }],
            },
            select: {
              id: true,
              title: true,
              summary: true,
              severity: true,
              status: true,
              monitor: { select: { id: true, environment: { select: { repositoryId: true } } } },
            },
            take: perType,
          })
        : [],
    ]);

    const byType: Record<SearchType, SearchResult[]> = {
      issue: issues.map((i) => ({
        type: 'issue',
        id: i.id,
        title: i.title,
        subtitle: `${i.project.key}-${i.number} · ${i.status}`,
        snippet: snippet(i.description, q),
        linkPath: `/orgs/${orgId}/workspaces/${i.project.workspaceId}/projects/${i.project.id}`,
      })),
      project: projects.map((p) => ({
        type: 'project',
        id: p.id,
        title: p.name,
        subtitle: `${p.key} · ${p.status}`,
        snippet: snippet(p.description, q),
        linkPath: `/orgs/${orgId}/workspaces/${p.workspaceId}/projects/${p.id}`,
      })),
      repository: repos.map((r) => ({
        type: 'repository',
        id: r.id,
        title: r.name,
        subtitle: r.slug,
        snippet: snippet(r.description, q),
        linkPath: `/orgs/${orgId}/repos/${r.id}`,
      })),
      pull_request: pulls.map((pr) => ({
        type: 'pull_request',
        id: pr.id,
        title: pr.title,
        subtitle: `#${pr.number} · ${pr.status}`,
        snippet: snippet(pr.description, q),
        linkPath: `/orgs/${orgId}/repos/${pr.repositoryId}`,
      })),
      doc: docs.map((d) => ({
        type: 'doc',
        id: d.id,
        title: d.title,
        subtitle: 'Documentation',
        snippet: snippet(d.content, q),
        linkPath: `/orgs/${orgId}/workspaces/${d.workspaceId}/docs?doc=${d.id}`,
      })),
      incident: incidents.map((inc) => ({
        type: 'incident',
        id: inc.id,
        title: inc.title,
        subtitle: `${inc.severity} · ${inc.status}`,
        snippet: snippet(inc.summary, q),
        linkPath: `/orgs/${orgId}/repos/${inc.monitor.environment.repositoryId}/monitoring/${inc.monitor.id}`,
      })),
    };

    const groups = GROUP_ORDER.map(({ type, label }) => ({
      type,
      label,
      results: byType[type],
    })).filter((g) => g.results.length > 0);

    const total = groups.reduce((n, g) => n + g.results.length, 0);
    return { query: q, total, groups };
  }

  // ── Saved searches ─────────────────────────────────────────

  listSaved(orgId: string, userId: string) {
    return this.prisma.savedSearch.findMany({
      where: { organizationId: orgId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  createSaved(orgId: string, userId: string, dto: CreateSavedSearchDto) {
    return this.prisma.savedSearch.create({
      data: { organizationId: orgId, userId, name: dto.name, query: dto.query },
    });
  }

  async removeSaved(orgId: string, userId: string, id: string) {
    const found = await this.prisma.savedSearch.findFirst({
      where: { id, organizationId: orgId, userId },
    });
    if (!found) throw new NotFoundException('Saved search not found');
    await this.prisma.savedSearch.delete({ where: { id } });
    return { success: true };
  }
}
