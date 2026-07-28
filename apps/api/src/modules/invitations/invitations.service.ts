import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvitationStatus, MembershipStatus, OrgRole } from '@rant/database';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { MailService } from '../../common/mail/mail.service';
import { BillingService } from '../billing/billing.service';
import { CreateInvitationDto } from './dto/invitation.dto';

const INVITE_TTL_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly billing: BillingService,
    private readonly config: ConfigService,
  ) {}

  private webUrl(): string {
    return this.config.get<string>('WEB_URL', 'http://localhost:3000').replace(/\/$/, '');
  }

  /** Create (or refresh) a pending invitation and "email" the invitee a link. */
  async create(orgId: string, actorId: string, dto: CreateInvitationDto) {
    if (dto.role === OrgRole.OWNER) {
      throw new BadRequestException('Cannot invite someone as OWNER; transfer ownership instead');
    }

    const email = dto.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const member = await this.prisma.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: existingUser.id } },
      });
      if (member) throw new BadRequestException('That person is already a member');
    }

    // Gate against the org's plan seat limit before issuing the invite.
    await this.billing.assertWithinLimit(orgId, 'members');

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * DAY);

    // One row per (org, email): re-inviting refreshes the token + expiry.
    const invitation = await this.prisma.invitation.upsert({
      where: { organizationId_email: { organizationId: orgId, email } },
      create: {
        organizationId: orgId,
        email,
        role: dto.role,
        token,
        invitedById: actorId,
        expiresAt,
        status: InvitationStatus.PENDING,
      },
      update: {
        role: dto.role,
        token,
        invitedById: actorId,
        expiresAt,
        status: InvitationStatus.PENDING,
        acceptedAt: null,
      },
      include: { organization: { select: { name: true } } },
    });

    const link = `${this.webUrl()}/invite/${token}`;
    await this.mail.send(
      email,
      `You're invited to join ${invitation.organization.name} on rant`,
      [
        `You've been invited to join ${invitation.organization.name} as ${dto.role}.`,
        '',
        `Accept your invitation: ${link}`,
        '',
        `This link expires in ${INVITE_TTL_DAYS} days.`,
      ].join('\n'),
    );

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'invitation.sent',
      targetType: 'Invitation',
      targetId: invitation.id,
      metadata: { email, role: dto.role },
    });

    return this.serialize(invitation);
  }

  /** All invitations for an org (managers see the pipeline). */
  async list(orgId: string) {
    const rows = await this.prisma.invitation.findMany({
      where: { organizationId: orgId },
      include: { invitedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.serialize(r));
  }

  async revoke(orgId: string, invitationId: string, actorId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: orgId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new BadRequestException('That invitation was already accepted');
    }

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.REVOKED },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'invitation.revoked',
      targetType: 'Invitation',
      targetId: invitation.id,
      metadata: { email: invitation.email },
    });
    return { success: true };
  }

  /** Public preview of an invitation by token (shown before/without sign-in). */
  async preview(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { organization: { select: { name: true, slug: true } } },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');

    const expired = invitation.expiresAt.getTime() < Date.now();
    return {
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.organization.name,
      organizationSlug: invitation.organization.slug,
      status: invitation.status,
      expired,
      expiresAt: invitation.expiresAt,
    };
  }

  /** The signed-in invitee accepts, becoming an active member. */
  async accept(token: string, userId: string, userEmail: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { token } });
    if (!invitation) throw new NotFoundException('Invitation not found');

    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new BadRequestException('This invitation has already been accepted');
    }
    if (invitation.status === InvitationStatus.REVOKED) {
      throw new GoneException('This invitation was revoked');
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new GoneException('This invitation has expired');
    }
    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenException('This invitation was issued to a different email address');
    }

    const already = await this.prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: invitation.organizationId, userId } },
    });
    if (already) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
      });
      throw new BadRequestException('You are already a member of this organization');
    }

    await this.billing.assertWithinLimit(invitation.organizationId, 'members');

    const [membership] = await this.prisma.$transaction([
      this.prisma.organizationMembership.create({
        data: {
          organizationId: invitation.organizationId,
          userId,
          role: invitation.role,
          status: MembershipStatus.ACTIVE,
        },
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
      }),
    ]);

    await this.audit.record({
      organizationId: invitation.organizationId,
      actorId: userId,
      action: 'invitation.accepted',
      targetType: 'User',
      targetId: userId,
      metadata: { role: invitation.role },
    });

    return { organizationId: invitation.organizationId, role: membership.role };
  }

  private serialize(row: {
    id: string;
    email: string;
    role: OrgRole;
    status: InvitationStatus;
    expiresAt: Date;
    createdAt: Date;
    acceptedAt: Date | null;
    invitedBy?: { id: string; name: string };
  }) {
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      acceptedAt: row.acceptedAt,
      invitedBy: row.invitedBy ?? null,
    };
  }
}
