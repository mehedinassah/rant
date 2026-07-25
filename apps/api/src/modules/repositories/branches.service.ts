import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RepositoriesService } from './repositories.service';
import { CreateBranchDto } from './dto/repository.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly repos: RepositoriesService,
  ) {}

  async list(orgId: string, repoId: string) {
    await this.repos.assertRepo(orgId, repoId);
    return this.prisma.branch.findMany({
      where: { repositoryId: repoId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async create(orgId: string, repoId: string, actorId: string, dto: CreateBranchDto) {
    const repo = await this.repos.assertRepo(orgId, repoId);
    const fromName = dto.fromBranch ?? repo.defaultBranch;

    const source = await this.prisma.branch.findUnique({
      where: { repositoryId_name: { repositoryId: repoId, name: fromName } },
    });
    if (!source) throw new BadRequestException(`Source branch "${fromName}" does not exist`);

    const clash = await this.prisma.branch.findUnique({
      where: { repositoryId_name: { repositoryId: repoId, name: dto.name } },
    });
    if (clash) throw new ConflictException('Branch already exists');

    const branch = await this.prisma.branch.create({
      data: {
        repositoryId: repoId,
        name: dto.name,
        headCommitSha: source.headCommitSha,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'branch.created',
      targetType: 'Branch',
      targetId: branch.id,
      metadata: { name: branch.name, from: fromName },
    });

    return branch;
  }

  async remove(orgId: string, repoId: string, name: string, actorId: string) {
    await this.repos.assertRepo(orgId, repoId);
    const branch = await this.prisma.branch.findUnique({
      where: { repositoryId_name: { repositoryId: repoId, name } },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.isDefault) throw new BadRequestException('Cannot delete the default branch');

    await this.prisma.branch.delete({ where: { id: branch.id } });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'branch.deleted',
      targetType: 'Branch',
      targetId: branch.id,
      metadata: { name },
    });
    return { success: true };
  }
}
