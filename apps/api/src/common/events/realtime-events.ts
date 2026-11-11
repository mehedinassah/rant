/**
 * Realtime (WebSocket) event contracts. Domain events stay on the internal bus;
 * this module republishes the subset a connected client cares about, over
 * Socket.IO, to the rooms a user is allowed to be in.
 */

export const RealtimeEvent = {
  /** Persisted in-app notification created for one user. */
  NotificationCreated: 'realtime.notification.created',
  /** A chat message (human or system) was posted to a channel. */
  ChatMessageCreated: 'realtime.chat.message',
} as const;

export interface NotificationCreatedPayload {
  userId: string;
  organizationId?: string | null;
  type: string;
  title: string;
  linkPath?: string | null;
}

export interface ChatMessageCreatedPayload {
  orgId: string;
  channelId: string;
  message: unknown;
}

/** Outbound Socket.IO event names (what clients listen for). */
export const RealtimeOutbound = {
  CommitCreated: 'commit.created',
  PullRequestOpened: 'pull_request.opened',
  PipelineRunCompleted: 'pipeline_run.completed',
  DeploymentCompleted: 'deployment.completed',
  IncidentOpened: 'incident.opened',
  IncidentResolved: 'incident.resolved',
  NotificationCreated: 'notification.created',
  ChatMessage: 'chat.message',
} as const;
