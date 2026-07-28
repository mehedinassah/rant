import { normalizePage } from './pagination';

describe('normalizePage', () => {
  it('defaults to page 1, size 25', () => {
    expect(normalizePage()).toEqual({ skip: 0, take: 25, page: 1, pageSize: 25 });
  });

  it('computes skip from page + size', () => {
    expect(normalizePage(3, 10)).toEqual({ skip: 20, take: 10, page: 3, pageSize: 10 });
  });

  it('clamps page to a minimum of 1', () => {
    expect(normalizePage(0, 10).page).toBe(1);
    expect(normalizePage(-5, 10).page).toBe(1);
  });

  it('clamps pageSize to [1, maxPageSize]', () => {
    expect(normalizePage(1, 9999).pageSize).toBe(100);
    expect(normalizePage(1, 0).pageSize).toBe(25); // falsy → default
    expect(normalizePage(1, 250, 500).pageSize).toBe(250);
  });

  it('floors fractional input', () => {
    expect(normalizePage(2.9, 10.7).page).toBe(2);
    expect(normalizePage(2.9, 10.7).pageSize).toBe(10);
  });
});
