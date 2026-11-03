import { describe, expect, it } from 'vitest';
import { nightCounts } from '../src/digest/counts.js';

describe('nightCounts', () => {
  it('counts run lines by status and skips bad lines', () => {
    expect(nightCounts('runs', '2026-10-28')).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('is null for a night with no file', () => {
    expect(nightCounts('runs', '2000-01-01')).toBeNull();
  });
});
