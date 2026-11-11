import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AppEvent,
  CommitCreatedPayload,
  DeployEvent,
  DeploymentCompletedPayload,
  IncidentOpenedPayload,
  IncidentResolvedPayload,
  MonitorEvent,
  PipelineRunCompletedPayload,
  PullRequestOpenedPayload,
} from '../events/app-events';
import {
  ChatMessageCreatedPayload,
  NotificationCreatedPayload,
  RealtimeEvent,
  RealtimeOutbound,
} from '../events/realtime-events';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Bridges the internal event bus onto the WebSocket gateway. Every listener is
 * a thin translation from a domain payload to an org/user/channel room — the
 * business modules stay unaware that a socket layer exists.
 */
@Injectable()
export class RealtimeBridge {
  constructor(private readonly gateway: RealtimeGateway) {}

  @OnEvent(AppEvent.CommitCreated)
  onCommit(p: CommitCreatedPayload) {
    this.gateway.emitToOrg(p.orgId, RealtimeOutbound.CommitCreated, p);
  }

  @OnEvent(AppEvent.PullRequestOpened)
  onPullRequest(p: PullRequestOpenedPayload) {
    this.gateway.emitToOrg(p.orgId, RealtimeOutbound.PullRequestOpened, p);
  }

  @OnEvent(AppEvent.PipelineRunCompleted)
  onRunCompleted(p: PipelineRunCompletedPayload) {
    this.gateway.emitToOrg(p.orgId, RealtimeOutbound.PipelineRunCompleted, p);
  }

  @OnEvent(DeployEvent.Completed)
  onDeploymentCompleted(p: DeploymentCompletedPayload) {
    this.gateway.emitToOrg(p.orgId, RealtimeOutbound.DeploymentCompleted, p);
  }

  @OnEvent(MonitorEvent.IncidentOpened)
  onIncidentOpened(p: IncidentOpenedPayload) {
    this.gateway.emitToOrg(p.orgId, RealtimeOutbound.IncidentOpened, p);
  }

  @OnEvent(MonitorEvent.IncidentResolved)
  onIncidentResolved(p: IncidentResolvedPayload) {
    this.gateway.emitToOrg(p.orgId, RealtimeOutbound.IncidentResolved, p);
  }

  @OnEvent(RealtimeEvent.NotificationCreated)
  onNotification(p: NotificationCreatedPayload) {
    this.gateway.emitToUser(p.userId, RealtimeOutbound.NotificationCreated, p);
  }

  @OnEvent(RealtimeEvent.ChatMessageCreated)
  onChatMessage(p: ChatMessageCreatedPayload) {
    this.gateway.emitToOrg(p.orgId, RealtimeOutbound.ChatMessage, p);
    this.gateway.emitToChannel(p.channelId, RealtimeOutbound.ChatMessage, p);
  }
}
