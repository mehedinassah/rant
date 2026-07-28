import { CopilotEngine } from './copilot.engine';

// The engine only needs Prisma for data retrieval; intent classification is pure.
const engine = new CopilotEngine({} as never);

describe('CopilotEngine.classify', () => {
  it('routes health questions', () => {
    expect(engine.classify("what's broken?")).toBe('health');
    expect(engine.classify('is anything down or failing?')).toBe('health');
    expect(engine.classify('any incidents?')).toBe('health');
  });

  it('routes shipped/activity questions', () => {
    expect(engine.classify('what shipped this week?')).toBe('shipped');
    expect(engine.classify('what got deployed recently')).toBe('shipped');
  });

  it('routes personal-work questions', () => {
    expect(engine.classify('what should I work on next?')).toBe('mywork');
    expect(engine.classify('show my tasks')).toBe('mywork');
  });

  it('routes summary questions', () => {
    expect(engine.classify('give me a summary')).toBe('summary');
    expect(engine.classify('how are we doing')).toBe('summary');
  });

  it('routes help', () => {
    expect(engine.classify('what can you do?')).toBe('help');
  });

  it('returns null for unmatched input', () => {
    expect(engine.classify('the quick brown fox')).toBeNull();
  });
});
