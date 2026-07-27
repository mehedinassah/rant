import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { DocsService } from './docs.service';
import { CreateDocDto, UpdateDocDto } from './dto/doc.dto';

/** Editors: any contributor role (VIEWER/GUEST are read-only). */
const EDITOR_ROLES = [OrgRole.MANAGER, OrgRole.DEVELOPER, OrgRole.QA, OrgRole.DEVOPS];

@Controller('organizations/:orgId/workspaces/:workspaceId/docs')
export class DocsController {
  constructor(private readonly docs: DocsService) {}

  @Get()
  list(@Param('orgId') orgId: string, @Param('workspaceId') workspaceId: string) {
    return this.docs.list(orgId, workspaceId);
  }

  @Roles(...EDITOR_ROLES)
  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateDocDto,
  ) {
    return this.docs.create(orgId, workspaceId, userId, dto);
  }

  @Get(':docId')
  get(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('docId') docId: string,
  ) {
    return this.docs.findDoc(orgId, workspaceId, docId);
  }

  @Roles(...EDITOR_ROLES)
  @Patch(':docId')
  update(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('docId') docId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateDocDto,
  ) {
    return this.docs.update(orgId, workspaceId, docId, userId, dto);
  }

  @Roles(...EDITOR_ROLES)
  @Delete(':docId')
  remove(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('docId') docId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.docs.remove(orgId, workspaceId, docId, userId);
  }

  // ── Revisions ─────────────────────────────────────────────

  @Get(':docId/revisions')
  listRevisions(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('docId') docId: string,
  ) {
    return this.docs.listRevisions(orgId, workspaceId, docId);
  }

  @Get(':docId/revisions/:revisionId')
  getRevision(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('docId') docId: string,
    @Param('revisionId') revisionId: string,
  ) {
    return this.docs.getRevision(orgId, workspaceId, docId, revisionId);
  }

  @Roles(...EDITOR_ROLES)
  @Post(':docId/revisions/:revisionId/restore')
  restore(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('docId') docId: string,
    @Param('revisionId') revisionId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.docs.restoreRevision(orgId, workspaceId, docId, revisionId, userId);
  }
}
