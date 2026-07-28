import { Injectable } from '@nestjs/common';
import {
  DeploymentStatus,
  IncidentStatus,
  IssueStatus,
  MonitorStatus,
  PullRequestStatus,
  RunStatus,
} from '@rant/database';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface Citation {
  label: string;
  linkPath: string;
}

export interface CopilotReply {
  content: string;
  citations: Citation[];
}

type Intent = 'health' | 'shipped' | 'mywork' | 'summary' | 'help';

const INTENT_PATTERNS: { intent: Intent; re: RegExp }[] = [
  { intent: 'health', re: /\b(broke|broken|down|incidents?|outages?|failing|failed|fire|alerts?|wrong|health|status)\b/i },
  { intent: 'shipped', re: /\b(ship|shipped|deploy|deployed|release|released|merged|recent|activity|this week|happened)\b/i },
  { intent: 'mywork', re: /\b(my (work|tasks?|issues?|todos?)|assigned to me|what should i|work on|what.?s next|my plate)\b/i },
  { intent: 'summary', re: /\b(summary|summarise|summarize|overview|how are we|report|standup|stand-up|digest|doing)\b/i },
  { intent: 'help', re: /\b(help|what can you|capabilit|who are you|how do you work)\b/i },
];

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class CopilotEngine {
  constructor(private readonly prisma: PrismaService) {}

  classify(message: string): Intent | null {
    for (const { intent, re } of INTENT_PATTERNS) if (re.test(message)) return intent;
    return null;
  }

  async respond(orgId: string, userId: string, message: string): Promise<CopilotReply> {
    switch (this.classify(message)) {
      case 'health':
        return this.health(orgId);
      case 'shipped':
        return this.shipped(orgId);
      case 'mywork':
        return this.myWork(orgId, userId);
      case 'summary':
        return this.summary(orgId);
      case 'help':
        return this.help();
      default:
        return this.fallback();
    }
  }

  // ── Intents ────────────────────────────────────────────────

  private async health(orgId: string): Promise<CopilotReply> {
    const since = new Date(Date.now() - 7 * DAY);
    const [incidents, downMonitors, failedDeploys, failedRuns] = await Promise.all([
      this.prisma.incident.findMany({
        where: {
          status: { not: IncidentStatus.RESOLVED },
          monitor: { environment: { repository: { organizationId: orgId } } },
        },
        select: {
          title: true,
          severity: true,
          monitor: { select: { id: true, environment: { select: { repositoryId: true } } } },
        },
        take: 10,
      }),
      this.prisma.monitor.findMany({
        where: {
          status: MonitorStatus.DOWN,
          environment: { repository: { organizationId: orgId } },
        },
        select: { id: true, name: true, environment: { select: { repositoryId: true } } },
        take: 10,
      }),
      this.prisma.deployment.findMany({
        where: {
          status: DeploymentStatus.FAILED,
          createdAt: { gte: since },
          environment: { repository: { organizationId: orgId } },
        },
        select: { id: true, branch: true, environment: { select: { name: true, repositoryId: true } } },
        take: 5,
      }),
      this.prisma.pipelineRun.findMany({
        where: {
          status: RunStatus.FAILED,
          createdAt: { gte: since },
          pipeline: { repository: { organizationId: orgId } },
        },
        select: { id: true, branch: true, pipeline: { select: { repositoryId: true } } },
        take: 5,
      }),
    ]);

    const citations: Citation[] = [];
    const lines: string[] = [];

    if (incidents.length === 0 && downMonitors.length === 0 && failedDeploys.length === 0 && failedRuns.length === 0) {
      return {
        content:
          '✅ Everything looks healthy. No open incidents, every monitor is operational, and there have been no CI or deployment failures in the last 7 days.',
        citations: [],
      };
    }

    if (incidents.length) {
      lines.push(`🔴 ${incidents.length} open incident${incidents.length > 1 ? 's' : ''}:`);
      for (const i of incidents) {
        lines.push(`  • [${i.severity}] ${i.title}`);
        citations.push({
          label: i.title,
          linkPath: `/orgs/${orgId}/repos/${i.monitor.environment.repositoryId}/monitoring/${i.monitor.id}`,
        });
      }
    }
    if (downMonitors.length) {
      lines.push(`⚠️ ${downMonitors.length} monitor(s) reporting DOWN:`);
      for (const m of downMonitors) {
        lines.push(`  • ${m.name}`);
        citations.push({
          label: m.name,
          linkPath: `/orgs/${orgId}/repos/${m.environment.repositoryId}/monitoring/${m.id}`,
        });
      }
    }
    if (failedRuns.length) {
      lines.push(`✕ ${failedRuns.length} failed CI run(s) this week (branches: ${failedRuns.map((r) => r.branch).join(', ')}).`);
      for (const r of failedRuns) {
        citations.push({ label: `CI run on ${r.branch}`, linkPath: `/orgs/${orgId}/repos/${r.pipeline.repositoryId}/runs/${r.id}` });
      }
    }
    if (failedDeploys.length) {
      lines.push(`✕ ${failedDeploys.length} failed deployment(s) this week.`);
      for (const d of failedDeploys) {
        citations.push({ label: `Deploy to ${d.environment.name}`, linkPath: `/orgs/${orgId}/repos/${d.environment.repositoryId}/deployments/${d.id}` });
      }
    }

    return { content: lines.join('\n'), citations };
  }

  private async shipped(orgId: string): Promise<CopilotReply> {
    const since = new Date(Date.now() - 7 * DAY);
    const [deploys, mergedPrs, doneIssues] = await Promise.all([
      this.prisma.deployment.findMany({
        where: {
          status: DeploymentStatus.READY,
          createdAt: { gte: since },
          environment: { repository: { organizationId: orgId } },
        },
        select: { id: true, url: true, environment: { select: { name: true, repositoryId: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.pullRequest.count({
        where: { status: PullRequestStatus.MERGED, mergedAt: { gte: since }, repository: { organizationId: orgId } },
      }),
      this.prisma.issue.count({
        where: { status: IssueStatus.DONE, updatedAt: { gte: since }, project: { workspace: { organizationId: orgId } } },
      }),
    ]);

    if (deploys.length === 0 && mergedPrs === 0 && doneIssues === 0) {
      return { content: 'Nothing has shipped in the last 7 days — no deployments, merged pull requests, or completed issues yet.', citations: [] };
    }

    const citations: Citation[] = [];
    const lines: string[] = ['Here’s what shipped in the last 7 days:'];
    lines.push(`  • 🚀 ${deploys.length} successful deployment(s)`);
    lines.push(`  • 🔀 ${mergedPrs} pull request(s) merged`);
    lines.push(`  • ✅ ${doneIssues} issue(s) completed`);
    for (const d of deploys.slice(0, 5)) {
      citations.push({ label: `${d.environment.name}${d.url ? ` — ${d.url}` : ''}`, linkPath: `/orgs/${orgId}/repos/${d.environment.repositoryId}/deployments/${d.id}` });
    }
    return { content: lines.join('\n'), citations };
  }

  private async myWork(orgId: string, userId: string): Promise<CopilotReply> {
    const issues = await this.prisma.issue.findMany({
      where: {
        assigneeId: userId,
        status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELLED] },
        project: { workspace: { organizationId: orgId } },
      },
      select: {
        id: true,
        number: true,
        title: true,
        priority: true,
        status: true,
        project: { select: { id: true, key: true, workspaceId: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 10,
    });

    if (issues.length === 0) {
      return { content: '🎉 You have no open issues assigned to you right now. Nice and clear!', citations: [] };
    }

    const citations: Citation[] = [];
    const lines: string[] = [`You have ${issues.length} open issue(s) assigned, highest priority first:`];
    for (const i of issues) {
      lines.push(`  • ${i.project.key}-${i.number} [${i.priority}/${i.status}] ${i.title}`);
      citations.push({ label: `${i.project.key}-${i.number}`, linkPath: `/orgs/${orgId}/workspaces/${i.project.workspaceId}/projects/${i.project.id}` });
    }
    return { content: lines.join('\n'), citations };
  }

  private async summary(orgId: string): Promise<CopilotReply> {
    const [openIssues, deployments, runs, incidents, monitors] = await Promise.all([
      this.prisma.issue.count({
        where: { status: { notIn: [IssueStatus.DONE, IssueStatus.CANCELLED] }, project: { workspace: { organizationId: orgId } } },
      }),
      this.prisma.deployment.count({ where: { environment: { repository: { organizationId: orgId } } } }),
      this.prisma.pipelineRun.findMany({ where: { pipeline: { repository: { organizationId: orgId } } }, select: { status: true } }),
      this.prisma.incident.count({ where: { status: { not: IncidentStatus.RESOLVED }, monitor: { environment: { repository: { organizationId: orgId } } } } }),
      this.prisma.monitor.findMany({ where: { environment: { repository: { organizationId: orgId } }, isActive: true }, select: { status: true } }),
    ]);
    const ok = runs.filter((r) => r.status === RunStatus.SUCCESS).length;
    const bad = runs.filter((r) => r.status === RunStatus.FAILED).length;
    const passRate = ok + bad > 0 ? Math.round((ok / (ok + bad)) * 100) : null;
    const up = monitors.filter((m) => m.status === MonitorStatus.UP).length;

    const content = [
      'Here’s the state of your organisation:',
      `  • 📋 ${openIssues} open issue(s)`,
      `  • 🚀 ${deployments} deployment(s) all-time`,
      `  • 🧪 CI pass rate: ${passRate === null ? 'n/a' : `${passRate}%`}`,
      `  • 🔴 ${incidents} open incident(s)`,
      `  • 📡 ${up}/${monitors.length} monitors operational`,
      '',
      'Ask “what’s broken?” or “what shipped this week?” for detail.',
    ].join('\n');
    return { content, citations: [] };
  }

  private help(): CopilotReply {
    return {
      content: [
        'I’m your rant copilot. My answers are grounded in your organisation’s live data — I don’t make things up, and I cite what I looked at. Try:',
        '  • “What’s broken right now?” — open incidents, down monitors, recent CI/deploy failures',
        '  • “What shipped this week?” — deployments, merged PRs, completed issues',
        '  • “What should I work on?” — your open issues by priority',
        '  • “Give me a summary” — an org-wide status snapshot',
      ].join('\n'),
      citations: [],
    };
  }

  private fallback(): CopilotReply {
    return {
      content:
        'I’m grounded in your org’s data across issues, CI, deployments and monitoring. I can answer things like “what’s broken?”, “what shipped this week?”, “what should I work on?”, or “give me a summary.” What would you like to know?',
      citations: [],
    };
  }
}
