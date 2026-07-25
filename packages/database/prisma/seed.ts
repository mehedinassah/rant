import { PrismaClient, OrgRole, ProjectStatus } from '@prisma/client';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();

// NOTE: the API hashes passwords with argon2. For seed convenience we only
// need a deterministic placeholder; the seeded user is meant for local demos.
// Log in via the register endpoint to get a real argon2 hash.
function placeholderHash(input: string): string {
  return 'seed$' + createHash('sha256').update(input).digest('hex');
}

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: 'founder@rant.dev' },
    update: {},
    create: {
      email: 'founder@rant.dev',
      name: 'Rant Founder',
      passwordHash: placeholderHash('password123'),
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

  await prisma.project.upsert({
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

  console.log('✅ Seed complete:');
  console.log(`   owner:     ${owner.email}`);
  console.log(`   org:       ${org.slug}`);
  console.log(`   workspace: ${workspace.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
