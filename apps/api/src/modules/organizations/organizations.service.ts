import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipStatus, OrgRole } from '@rant/database';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  CreateOrganizationDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Organizations the user is an active member of. */
  async listForUser(userId: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { userId, status: MembershipStatus.ACTIVE },
      include: {
        organization: {
          include: { _count: { select: { memberships: true, workspaces: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({ ...m.organization, role: m.role }));
  }

  async create(userId: string, dto: CreateOrganizationDto) {
    const clash = await this.prisma.organization.findUnique({ where: { slug: dto.slug } });
    if (clash) throw new ConflictException('Organization slug already taken');

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        ownerId: userId,
        memberships: { create: { userId, role: OrgRole.OWNER } },
      },
    });

    await this.audit.record({
      organizationId: org.id,
      actorId: userId,
      action: 'organization.created',
      targetType: 'Organization',
      targetId: org.id,
      metadata: { slug: org.slug },
    });

    return org;
  }

  async findById(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { _count: { select: { memberships: true, workspaces: true } } },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(orgId: string, actorId: string, dto: UpdateOrganizationDto) {
    await this.findById(orgId);
    const org = await this.prisma.organization.update({ where: { id: orgId }, data: dto });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'organization.updated',
      targetType: 'Organization',
      targetId: orgId,
      metadata: { ...dto },
    });
    return org;
  }

  async remove(orgId: string, actorId: string) {
    const org = await this.findById(orgId);
    if (org.ownerId !== actorId) {
      throw new ForbiddenException('Only the owner can delete the organization');
    }
    await this.prisma.organization.delete({ where: { id: orgId } });
    await this.audit.record({
      actorId,
      action: 'organization.deleted',
      targetType: 'Organization',
      targetId: orgId,
      metadata: { slug: org.slug },
    });
    return { success: true };
  }

  // ── Members ───────────────────────────────────────────────

  async listMembers(orgId: string) {
    return this.prisma.organizationMembership.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async inviteMember(orgId: string, actorId: string, dto: InviteMemberDto) {
    if (dto.role === OrgRole.OWNER) {
      throw new BadRequestException('Cannot assign OWNER via invite; transfer ownership instead');
    }

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      // In a full build this would create a pending invite + email. For now we
      // require the invitee to already have a rant account.
      throw new NotFoundException('No rant user with that email');
    }

    const existing = await this.prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
    });
    if (existing) throw new ConflictException('User is already a member');

    const membership = await this.prisma.organizationMembership.create({
      data: {
        organizationId: orgId,
        userId: user.id,
        role: dto.role,
        status: MembershipStatus.ACTIVE,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'member.invited',
      targetType: 'User',
      targetId: user.id,
      metadata: { role: dto.role },
    });

    return membership;
  }

  async updateMemberRole(orgId: string, targetUserId: string, actorId: string, dto: UpdateMemberRoleDto) {
    const membership = await this.prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
    });
    if (!membership) throw new NotFoundException('Member not found');

    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    if (membership.userId === org.ownerId) {
      throw new BadRequestException("Cannot change the owner's role");
    }
    if (dto.role === OrgRole.OWNER) {
      throw new BadRequestException('Use ownership transfer to assign OWNER');
    }

    const updated = await this.prisma.organizationMembership.update({
      where: { id: membership.id },
      data: { role: dto.role },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'member.role_changed',
      targetType: 'User',
      targetId: targetUserId,
      metadata: { from: membership.role, to: dto.role },
    });

    return updated;
  }

  async removeMember(orgId: string, targetUserId: string, actorId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    if (targetUserId === org.ownerId) {
      throw new BadRequestException('Cannot remove the organization owner');
    }
    const membership = await this.prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
    });
    if (!membership) throw new NotFoundException('Member not found');

    await this.prisma.organizationMembership.delete({ where: { id: membership.id } });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'member.removed',
      targetType: 'User',
      targetId: targetUserId,
    });
    return { success: true };
  }
}
