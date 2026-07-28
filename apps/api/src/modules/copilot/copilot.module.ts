import { Module } from '@nestjs/common';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';
import { CopilotEngine } from './copilot.engine';

@Module({
  controllers: [CopilotController],
  providers: [CopilotService, CopilotEngine],
})
export class CopilotModule {}
