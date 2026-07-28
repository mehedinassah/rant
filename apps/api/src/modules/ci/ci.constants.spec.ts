import { DEFAULT_DEFINITION, stepShouldFail } from './ci.constants';

describe('stepShouldFail', () => {
  it('fails on explicit failure signals', () => {
    expect(stepShouldFail('exit 1')).toBe(true);
    expect(stepShouldFail('something && false')).toBe(true);
    expect(stepShouldFail('run-fail-suite')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(stepShouldFail('EXIT 1')).toBe(true);
    expect(stepShouldFail('FAIL')).toBe(true);
  });

  it('passes on normal commands', () => {
    expect(stepShouldFail('pnpm install')).toBe(false);
    expect(stepShouldFail('pnpm build')).toBe(false);
    expect(stepShouldFail('git checkout main')).toBe(false);
  });
});

describe('DEFAULT_DEFINITION', () => {
  it('has build + test jobs with steps', () => {
    const names = DEFAULT_DEFINITION.jobs.map((j) => j.name);
    expect(names).toContain('build');
    expect(names).toContain('test');
    for (const job of DEFAULT_DEFINITION.jobs) {
      expect(job.steps.length).toBeGreaterThan(0);
    }
  });
});
