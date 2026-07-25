import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvent, PipelineRunCompletedPayload } from '../../common/events/app-events';
import { DeploymentsService } from './deployments.service';

/**
 * Completes the ripple: a green CI run auto-deploys. A successful push to a
 * watched branch ships to production; a successful PR run ships a preview.
 */
@Injectable()
export class DeploymentsListeners {
  private readonly logger = new Logger('DeployTriggers');

  constructor(private readonly deployments: DeploymentsService) {}

  @OnEvent(AppEvent.PipelineRunCompleted)
  async onRunCompleted(payload: PipelineRunCompletedPayload) {
    if (payload.status !== 'SUCCESS') return;
    const created = await this.deployments.autoDeployForRun(payload);
    if (created.length) {
      this.logger.log(
        `run success on ${payload.branch} → ${created.length} deployment(s)`,
      );
    }
  }
}
