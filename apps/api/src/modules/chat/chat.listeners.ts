import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AppEvent,
  DeployEvent,
  DeploymentCompletedPayload,
  IncidentOpenedPayload,
  IncidentResolvedPayload,
  MonitorEvent,
  PipelineRunCompletedPayload,
  PullRequestOpenedPayload,
} from '../../common/events/app-events';
import { ChatService } from './chat.service';

/**
 * The integration layer: domain events become SYSTEM messages in the org's
 * #activity channel. Deploys, incidents, CI failures and new PRs all show up
 * in chat automatically — the event bus flowing into the conversation.
 */
@Injectable()
export class ChatListeners {
  constructor(private readonly chat: ChatService) {}

  @OnEvent(DeployEvent.Completed)
  onDeploy(p: DeploymentCompletedPayload) {
    const body =
      p.status === 'READY'
        ? `🚀 Deployment succeeded${p.url ? ` — ${p.url}` : ''}`
        : '❌ Deployment failed';
    return this.chat.postSystem(p.orgId, body);
  }

  @OnEvent(MonitorEvent.IncidentOpened)
  onIncidentOpened(p: IncidentOpenedPayload) {
    return this.chat.postSystem(p.orgId, `🔴 ${p.severity} incident: ${p.title}`);
  }

  @OnEvent(MonitorEvent.IncidentResolved)
  onIncidentResolved(p: IncidentResolvedPayload) {
    return this.chat.postSystem(p.orgId, '✅ Incident resolved — the environment has recovered');
  }

  @OnEvent(AppEvent.PipelineRunCompleted)
  onRun(p: PipelineRunCompletedPayload) {
    if (p.status !== 'FAILED') return;
    return this.chat.postSystem(p.orgId, `❌ CI failed on ${p.branch}`);
  }

  @OnEvent(AppEvent.PullRequestOpened)
  onPullRequest(p: PullRequestOpenedPayload) {
    return this.chat.postSystem(p.orgId, `🔀 Pull request #${p.prNumber} opened from ${p.branch}`);
  }
}
