import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DeployEvent,
  DeploymentCompletedPayload,
} from '../../common/events/app-events';
import { MonitorsService } from './monitors.service';

/**
 * The ripple's final hop: once a deployment goes live, point its environment's
 * monitor at the new URL and start probing. A successful deploy also clears any
 * failing streak, so a fresh release recovers an environment automatically.
 */
@Injectable()
export class MonitoringListeners {
  private readonly logger = new Logger('MonitorTriggers');

  constructor(private readonly monitors: MonitorsService) {}

  @OnEvent(DeployEvent.Completed)
  async onDeploymentCompleted(payload: DeploymentCompletedPayload) {
    if (payload.status !== 'READY') return;
    await this.monitors.syncTargetForEnvironment(payload.environmentId, payload.url ?? null);
    this.logger.log(`monitoring ${payload.url} (env ${payload.environmentId})`);
  }
}
