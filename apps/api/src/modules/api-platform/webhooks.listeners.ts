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
import { WebhooksService } from './webhooks.service';

/**
 * Bridges the internal event bus to outbound webhooks: the same domain events
 * that drive CI, deploys, monitoring and notifications are broadcast to any
 * external systems an org has subscribed. The platform's ripples reach beyond
 * its own walls.
 */
@Injectable()
export class WebhooksListeners {
  constructor(private readonly webhooks: WebhooksService) {}

  @OnEvent(AppEvent.PullRequestOpened)
  onPullRequest(p: PullRequestOpenedPayload) {
    return this.webhooks.dispatch(p.orgId, AppEvent.PullRequestOpened, { ...p });
  }

  @OnEvent(AppEvent.PipelineRunCompleted)
  onRun(p: PipelineRunCompletedPayload) {
    return this.webhooks.dispatch(p.orgId, AppEvent.PipelineRunCompleted, { ...p });
  }

  @OnEvent(DeployEvent.Completed)
  onDeploy(p: DeploymentCompletedPayload) {
    return this.webhooks.dispatch(p.orgId, DeployEvent.Completed, { ...p });
  }

  @OnEvent(MonitorEvent.IncidentOpened)
  onIncidentOpened(p: IncidentOpenedPayload) {
    return this.webhooks.dispatch(p.orgId, MonitorEvent.IncidentOpened, { ...p });
  }

  @OnEvent(MonitorEvent.IncidentResolved)
  onIncidentResolved(p: IncidentResolvedPayload) {
    return this.webhooks.dispatch(p.orgId, MonitorEvent.IncidentResolved, { ...p });
  }
}
