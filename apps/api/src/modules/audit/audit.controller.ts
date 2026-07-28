import { Controller, Get, Param, Query } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from '../../common/audit/audit.service';

/** Audit history is sensitive — restricted to org OWNER/ADMIN. */
@Controller('organizations/:orgId/audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Roles(OrgRole.ADMIN)
  @Get()
  list(
    @Param('orgId') orgId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
  ) {
    return this.audit.list(orgId, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      action,
      actorId,
    });
  }
}
