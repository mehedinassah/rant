import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';

// AuditService is provided globally (common/audit); this module only exposes
// the read-side controller.
@Module({
  controllers: [AuditController],
})
export class AuditViewModule {}
