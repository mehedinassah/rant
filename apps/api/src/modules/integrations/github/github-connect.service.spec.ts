import { ForbiddenException } from '@nestjs/common';
import { GithubConnectService } from './github-connect.service';

function setup(claimedBy: string | null = null) {
  const prisma = {
    githubInstallation: {
      findUnique: jest.fn().mockResolvedValue(claimedBy ? { organizationId: claimedBy } : null),
      upsert: jest.fn().mockResolvedValue({ id: 'inst1', accountLogin: 'acme' }),
    },
  };
  const config = { appSlug: 'rant', clientId: 'cid' } as never;
  const auth = { getInstallationMeta: jest.fn().mockResolvedValue({ accountLogin: 'acme' }) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  const svc = new GithubConnectService(prisma as never, config, auth as never, audit as never, queue as never);
  return { svc, prisma, auth, audit, queue };
}

describe('GithubConnectService.completeInstall', () => {
  it('binds an unclaimed installation and enqueues backfill', async () => {
    const { svc, prisma, queue, audit } = setup(null);
    const res = await svc.completeInstall('orgA', 'user1', '999');
    expect(res).toEqual({ connected: true, accountLogin: 'acme' });
    expect(prisma.githubInstallation.upsert).toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith('sync', { installationId: '999' }, expect.any(Object));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'integration.github.connected' }),
    );
  });

  it('allows re-completing for the SAME org (idempotent)', async () => {
    const { svc, prisma } = setup('orgA');
    await expect(svc.completeInstall('orgA', 'user1', '999')).resolves.toBeTruthy();
    expect(prisma.githubInstallation.upsert).toHaveBeenCalled();
  });

  it('refuses to hijack an installation claimed by another org', async () => {
    const { svc, prisma } = setup('orgB');
    await expect(svc.completeInstall('orgA', 'user1', '999')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.githubInstallation.upsert).not.toHaveBeenCalled();
  });
});
