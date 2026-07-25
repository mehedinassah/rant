import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrganizationsService } from './organizations.service';
import {
  CreateOrganizationDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  list(@CurrentUser('userId') userId: string) {
    return this.organizations.listForUser(userId);
  }

  @Post()
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateOrganizationDto) {
    return this.organizations.create(userId, dto);
  }

  // Any active member can view (RolesGuard enforces membership on :orgId).
  @Get(':orgId')
  get(@Param('orgId') orgId: string) {
    return this.organizations.findById(orgId);
  }

  @Roles(OrgRole.MANAGER)
  @Patch(':orgId')
  update(
    @Param('orgId') orgId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizations.update(orgId, userId, dto);
  }

  // OWNER-only is enforced inside the service (owner check).
  @Delete(':orgId')
  remove(@Param('orgId') orgId: string, @CurrentUser('userId') userId: string) {
    return this.organizations.remove(orgId, userId);
  }

  // ── Members ───────────────────────────────────────────────

  @Get(':orgId/members')
  listMembers(@Param('orgId') orgId: string) {
    return this.organizations.listMembers(orgId);
  }

  @Roles(OrgRole.MANAGER)
  @Post(':orgId/members')
  invite(
    @Param('orgId') orgId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.organizations.inviteMember(orgId, userId, dto);
  }

  @Roles(OrgRole.MANAGER)
  @Patch(':orgId/members/:userId')
  updateRole(
    @Param('orgId') orgId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser('userId') actorId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.organizations.updateMemberRole(orgId, targetUserId, actorId, dto);
  }

  @Roles(OrgRole.MANAGER)
  @Delete(':orgId/members/:userId')
  removeMember(
    @Param('orgId') orgId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.organizations.removeMember(orgId, targetUserId, actorId);
  }
}
