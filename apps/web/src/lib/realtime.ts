'use client';

import { io, Socket } from 'socket.io-client';
import { API_ORIGIN, getAccessToken } from './api';

/**
 * One shared Socket.IO connection to the API's `/realtime` namespace.
 *
 * The JWT access token is presented on the handshake (`auth.token`); the server
 * verifies it and then requires an explicit, membership-checked subscription to
 * each org/channel room. Until a room is joined, the socket receives nothing but
 * its own user-targeted events (notifications).
 */

export interface NotificationCreatedEvent {
  userId: string;
  organizationId?: string | null;
  type: string;
  title: string;
  linkPath?: string | null;
}

export interface ChatMessageEvent {
  orgId: string;
  channelId: string;
  message: {
    id: string;
    kind: 'USER' | 'SYSTEM';
    body: string;
    createdAt: string;
    author?: { id: string; name: string; avatarUrl?: string | null } | null;
  };
}

export interface DeploymentCompletedEvent {
  orgId: string;
  repoId: string;
  environmentId: string;
  deploymentId: string;
  status: 'READY' | 'FAILED' | 'CANCELLED';
  url?: string | null;
}

export interface IncidentEvent {
  orgId: string;
  repoId: string;
  environmentId: string;
  monitorId: string;
  incidentId: string;
  severity?: 'MINOR' | 'MAJOR' | 'CRITICAL';
  title?: string;
}

export interface PipelineRunCompletedEvent {
  orgId: string;
  repoId: string;
  runId: string;
  pipelineId: string;
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  branch: string;
}

let socket: Socket | null = null;

/** Returns the shared socket, creating it once a token exists. */
export function connectRealtime(): Socket | null {
  if (typeof window === 'undefined') return null;
  const token = getAccessToken();
  if (!token) return null;

  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(`${API_ORIGIN}/realtime`, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });
  return socket;
}

/** Join an org room (server re-verifies active membership). */
export function joinOrg(orgId: string): void {
  connectRealtime()?.emit('subscribe:org', { orgId });
}

export function leaveOrg(orgId: string): void {
  socket?.emit('unsubscribe:org', { orgId });
}

/** Join a chat channel room (server checks the channel's org membership). */
export function joinChannel(channelId: string): void {
  connectRealtime()?.emit('subscribe:channel', { channelId });
}

export function leaveChannel(channelId: string): void {
  socket?.emit('unsubscribe:channel', { channelId });
}

/** Subscribe to an outbound event; returns an unsubscribe function. */
export function onRealtime<T>(event: string, handler: (payload: T) => void): () => void {
  const client = connectRealtime();
  if (!client) return () => undefined;
  const listener = (payload: T) => handler(payload);
  client.on(event, listener);
  return () => {
    client.off(event, listener);
  };
}

/** Drop the connection (call on logout / when the token is cleared). */
export function disconnectRealtime(): void {
  socket?.disconnect();
  socket = null;
}
