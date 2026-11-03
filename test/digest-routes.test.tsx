import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

// Plan morning-digest § 2d: route tests for GET /digest/:night (§ 2a) and GET /api/digest/:night (§ 2b).
// Fixtures live in a temp runs dir; runs/ is never touched.

const NORMAL = '2026-10-29';
const EMPTY = '2026-10-30';
const BAD = '2026-10-31';
const MISSING = '2026-10-28';

const normalLines = [
  '{"at":"2026-10-29T01:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
  '{"at":"2026-10-29T01:30:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-10-29T01:31:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-10-29T01:33:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-10-29T01:37:00+01:00","job":"fixtures/refresh","status":"ok","owner":"rook"}',
  '{"at":"2026-10-29T04:00:01+01:00","job":"notes/backup","status":"fail","owner":null,"error":"quota exceeded"}',
  '{"at":"2026-10-29T23:00:02+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}',
];

const NORMAL_JOBS = ['fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs'];

type Cells = { warn: boolean; cells: string[] };

// Body rows of the digest table: the warn marker and the cell texts, in page order.
function tableRows(html: string): Cells[] {
  const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(html)?.[1] ?? '';
  return [...body.matchAll(/<tr( class="([^"]*)")?>([\s\S]*?)<\/tr>/g)].map((m) => ({
    warn: m[2] === 'warn',
    cells: [...m[3]!.matchAll(/<td>([^<]*)<\/td>/g)].map((c) => c[1]!),
  }));
}

describe('digest routes', () => {
  let dir: string;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
    writeFileSync(join(dir, `${NORMAL}.jsonl`), normalLines.join('\n') + '\n');
    writeFileSync(join(dir, `${EMPTY}.jsonl`), '');
    writeFileSync(
      join(dir, `${BAD}.jsonl`),
      [
        '{"at":"2026-10-31T01:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
        '{"at":"2026-10-31T01:05:00+01:00","job":"lane/sync","status":"o',
        '{"at":"2026-10-31T02:00:00+01:00","job":"notes/backup","status":"ok","owner":"lane-07"}',
      ].join('\n') + '\n',
    );
    app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  describe('normal night', () => {
    it('page is 200 with the lane banner, every job, a dash for the null owner, and warn rows', async () => {
      const res = await app.request(`/digest/${NORMAL}`);
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain('<header>');
      for (const job of NORMAL_JOBS) expect(html).toContain(job);

      const rows = tableRows(html);
      expect(rows.map((r) => r.cells[0])).toEqual(NORMAL_JOBS);
      // notes/backup has a null owner: its owner cell is a dash, not empty and not dropped.
      expect(rows.find((r) => r.cells[0] === 'notes/backup')!.cells[1]).toBe('—');
      // 3 retries or a fail is marked; the rest are not.
      expect(rows.filter((r) => r.warn).map((r) => r.cells[0])).toEqual(['fixtures/refresh', 'notes/backup']);
    });

    it('JSON is 200 with rows sorted by job', async () => {
      const res = await app.request(`/api/digest/${NORMAL}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Night;
      expect(body.night).toBe(NORMAL);
      expect(body.badLines).toBe(0);
      expect(body.rows.map((r) => r.job)).toEqual(NORMAL_JOBS);
      expect(body.rows.find((r) => r.job === 'fixtures/refresh')).toMatchObject({
        owner: 'rook',
        runs: 4,
        retries: 3,
        lastStatus: 'ok',
        lastError: 'upstream 503',
      });
      expect(body.rows.find((r) => r.job === 'notes/backup')).toMatchObject({
        owner: null,
        lastStatus: 'fail',
        lastError: 'quota exceeded',
      });
    });
  });

  describe('night with no file', () => {
    it('page is 404 and says there is no run log', async () => {
      const res = await app.request(`/digest/${MISSING}`);
      const html = await res.text();
      expect(res.status).toBe(404);
      expect(html).toContain(`no run log for ${MISSING}`);
    });

    it('JSON is 404 with the error body', async () => {
      const res = await app.request(`/api/digest/${MISSING}`);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'no run log', night: MISSING });
    });
  });

  describe('empty night', () => {
    it('page is 200 and says nothing ran', async () => {
      const res = await app.request(`/digest/${EMPTY}`);
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain('nothing ran');
    });

    it('JSON is 200 with no rows and no bad lines', async () => {
      const res = await app.request(`/api/digest/${EMPTY}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ night: EMPTY, rows: [], badLines: 0 });
    });
  });

  describe('night with a bad line', () => {
    it('page is 200, renders the good rows, and says 1 line did not parse', async () => {
      const res = await app.request(`/digest/${BAD}`);
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(tableRows(html).map((r) => r.cells[0])).toEqual(['lane/sync', 'notes/backup']);
      expect(html).toContain('1 line did not parse');
    });

    it('JSON is 200 with the good rows and badLines 1', async () => {
      const res = await app.request(`/api/digest/${BAD}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Night;
      expect(body.badLines).toBe(1);
      expect(body.rows.map((r) => r.job)).toEqual(['lane/sync', 'notes/backup']);
    });
  });

  describe('page and JSON agree', () => {
    it('the normal night has the same jobs, in the same order, with the same owners', async () => {
      const html = await (await app.request(`/digest/${NORMAL}`)).text();
      const body = (await (await app.request(`/api/digest/${NORMAL}`)).json()) as Night;
      const rows = tableRows(html);
      expect(rows.map((r) => r.cells[0])).toEqual(body.rows.map((r) => r.job));
      expect(rows.map((r) => r.cells[1])).toEqual(body.rows.map((r) => r.owner ?? '—'));
    });
  });
});
