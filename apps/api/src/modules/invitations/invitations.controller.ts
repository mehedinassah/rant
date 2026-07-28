import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/invitation.dto';

@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  // ── Managed by org admins (RolesGuard enforces membership on :orgId) ──────

  @Roles(OrgRole.MANAGER)
  @Post('organizations/:orgId/invitations')
  create(
    @Param('orgId') orgId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitations.create(orgId, userId, dto);
  }

  @Roles(OrgRole.MANAGER)
  @Get('organizations/:orgId/invitations')
  list(@Param('orgId') orgId: string) {
    return this.invitations.list(orgId);
  }

  @Roles(OrgRole.MANAGER)
  @Delete('organizations/:orgId/invitations/:invitationId')
  revoke(
    @Param('orgId') orgId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.invitations.revoke(orgId, invitationId, userId);
  }

  // ── Invitee-facing (token-scoped, no org membership yet) ──────────────────

  @Public()
  @Get('invitations/:token')
  preview(@Param('token') token: string) {
    return this.invitations.preview(token);
  }

  @Post('invitations/:token/accept')
  accept(
    @Param('token') token: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('email') email: string,
  ) {
    return this.invitations.accept(token, userId, email);
  }
}
