import { Module } from '@nestjs/common';
import { DocsController } from './docs.controller';
import { DocsService } from './docs.service';
import { DocsListeners } from './docs.listeners';

@Module({
  controllers: [DocsController],
  providers: [DocsService, DocsListeners],
})
export class DocsModule {}
