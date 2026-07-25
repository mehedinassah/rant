import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { DEPLOY_QUEUE } from './deployments.constants';
import { EnvironmentsController } from './environments.controller';
import { EnvironmentsService } from './environments.service';
import { DeploymentsController } from './deployments.controller';
import { DeploymentsService } from './deployments.service';
import { DeploymentProcessor } from './deployment.processor';
import { DeploymentsListeners } from './deployments.listeners';

@Module({
  imports: [BullModule.registerQueue({ name: DEPLOY_QUEUE }), RepositoriesModule],
  controllers: [EnvironmentsController, DeploymentsController],
  providers: [
    EnvironmentsService,
    DeploymentsService,
    DeploymentProcessor,
    DeploymentsListeners,
  ],
})
export class DeploymentsModule {}
