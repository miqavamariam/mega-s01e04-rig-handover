import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28')!;

  it('finds 5 jobs and 1 bad line', () => {
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night.badLines).toBe(1);
  });

  it('counts runs and retries and keeps the last status and error', () => {
    const refresh = night.rows.find((r) => r.job === 'fixtures/refresh');
    expect(refresh).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      first: '2026-10-29T01:30:00+01:00',
      last: '2026-10-29T01:37:00+01:00',
    });
    const backup = night.rows.find((r) => r.job === 'notes/backup');
    expect(backup).toMatchObject({ runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps times with their offset, across midnight', () => {
    const sync = night.rows.find((r) => r.job === 'lane/sync');
    expect(sync).toMatchObject({
      runs: 8,
      retries: 1,
      lastError: 'lock held',
      first: '2026-10-28T23:00:06+01:00',
      last: '2026-10-29T05:00:04+01:00',
    });
  });

  it('keeps a row whose owner is null', () => {
    expect(night.rows.find((r) => r.job === 'digest/render')).toMatchObject({ owner: null, lastError: null });
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('returns null for a night with no file, or a name that is not a night', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('reads an empty file as a night with no rows', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('counts lines that are not run lines, never throws; a missing owner is kept', () => {
    writeFileSync(
      join(dir, '2026-01-03.jsonl'),
      [
        '{"at":"2026-01-03T23:00:00+01:00","job":"a","status":"ok","owner":"x"}',
        'not json',
        '[1,2]',
        '{"at":"2026-01-03T23:01:00+01:00","job":"a","status":"maybe","owner":"x"}',
        '{"at":"2026-01-03T23:02:00+01:00","job":"a","status":"ok"}',
        '',
      ].join('\n'),
    );
    const n = readNight(dir, '2026-01-03')!;
    expect(n.rows).toEqual([expect.objectContaining({ job: 'a', runs: 2, owner: null })]);
    expect(n.badLines).toBe(3);
  });
});
