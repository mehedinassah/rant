import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../repositories/repositories.module';
import { IntegrationLinksService } from './integration-links.service';

@Module({
  imports: [RepositoriesModule],
  providers: [IntegrationLinksService],
  exports: [IntegrationLinksService],
})
export class IntegrationsCommonModule {}
