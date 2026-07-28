import { deployShouldFail, deploymentUrl } from './deployments.constants';

describe('deploymentUrl', () => {
  it('uses the bare domain for production', () => {
    expect(deploymentUrl('site', 'production', true, '3')).toBe('https://site.rant.app');
  });

  it('includes env + discriminator for non-production', () => {
    expect(deploymentUrl('site', 'preview', false, 'pr-1')).toBe('https://site-preview-pr-1.rant.app');
    expect(deploymentUrl('api', 'staging', false, '7')).toBe('https://api-staging-7.rant.app');
  });
});

describe('deployShouldFail', () => {
  it('fails on break/fail branches', () => {
    expect(deployShouldFail('break-things')).toBe(true);
    expect(deployShouldFail('feature/fail')).toBe(true);
    expect(deployShouldFail('FAIL')).toBe(true);
  });

  it('passes on normal branches', () => {
    expect(deployShouldFail('main')).toBe(false);
    expect(deployShouldFail('feature/login')).toBe(false);
  });
});
