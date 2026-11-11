import {
  PrismaClient,
  OrgRole,
  ProjectStatus,
  SprintStatus,
  IssueType,
  IssueStatus,
  IssuePriority,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

/** Demo password for the seeded owner — hashed the same way the API verifies it. */
const DEMO_PASSWORD = 'password123';

async function main() {
  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  const owner = await prisma.user.upsert({
    where: { email: 'founder@rant.dev' },
    // Re-seeding repairs a previously placeholder hash so login keeps working.
    update: { passwordHash },
    create: {
      email: 'founder@rant.dev',
      name: 'Rant Founder',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: 'acme' },
    update: {},
    create: {
      name: 'Acme Corp',
      slug: 'acme',
      ownerId: owner.id,
      memberships: {
        create: { userId: owner.id, role: OrgRole.OWNER },
      },
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'engineering' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Engineering',
      slug: 'engineering',
      description: 'Where the software gets built.',
    },
  });

  const project = await prisma.project.upsert({
    where: { workspaceId_key: { workspaceId: workspace.id, key: 'RANT' } },
    update: {},
    create: {
      workspaceId: workspace.id,
      name: 'rant Platform',
      key: 'RANT',
      description: 'The operating system for modern software teams.',
      status: ProjectStatus.ACTIVE,
    },
  });

  // Only seed board data once (keeps `db:seed` idempotent-ish).
  const existingIssues = await prisma.issue.count({ where: { projectId: project.id } });
  if (existingIssues === 0) {
    const sprint = await prisma.sprint.create({
      data: {
        projectId: project.id,
        name: 'Sprint 1 — Foundations',
        goal: 'Ship auth, orgs, and the project board.',
        status: SprintStatus.ACTIVE,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    const epic = await prisma.epic.create({
      data: {
        projectId: project.id,
        name: 'Core Platform',
        description: 'The connective tissue every module builds on.',
        color: '#6d5efc',
      },
    });

    const seedIssues = [
      { title: 'Set up RBAC guards', type: IssueType.TASK, status: IssueStatus.DONE, priority: IssuePriority.HIGH, storyPoints: 3 },
      { title: 'Design the issue board', type: IssueType.STORY, status: IssueStatus.IN_PROGRESS, priority: IssuePriority.MEDIUM, storyPoints: 5 },
      { title: 'Refresh token rotation edge case', type: IssueType.BUG, status: IssueStatus.TODO, priority: IssuePriority.URGENT, storyPoints: 2 },
      { title: 'Write API smoke tests', type: IssueType.TASK, status: IssueStatus.BACKLOG, priority: IssuePriority.LOW, storyPoints: 3 },
    ];

    let n = 0;
    for (const data of seedIssues) {
      n += 1;
      await prisma.issue.create({
        data: {
          projectId: project.id,
          number: n,
          reporterId: owner.id,
          assigneeId: owner.id,
          sprintId: sprint.id,
          epicId: epic.id,
          ...data,
        },
      });
    }
    await prisma.project.update({
      where: { id: project.id },
      data: { issueCounter: n },
    });
  }

  console.log('✅ Seed complete:');
  console.log(`   owner:     ${owner.email} / ${DEMO_PASSWORD}`);
  console.log(`   org:       ${org.slug}`);
  console.log(`   workspace: ${workspace.slug}`);
  console.log(`   project:   ${project.key} (with sprint, epic, issues)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
