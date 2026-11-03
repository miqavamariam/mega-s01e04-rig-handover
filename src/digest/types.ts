// Plan morning-digest § 1. The contract every part of § 2 builds against: the page, the JSON,
// the board link and the route tests all read nights through `readNight`.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after it has been parsed and checked.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job. Times are the log's own strings, offset kept (styleguide).
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as `—`
  runs: number; // lines for this job, any status
  retries: number; // lines with status `retry`
  lastStatus: RunStatus;
  lastError: string | null; // the most recent `error` seen for this job, if any
  first: string;
  last: string;
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job, so the page and the JSON agree by construction
  badLines: number; // lines that did not parse; counted, never thrown
};

// Returns null when the night has no file (or is not a YYYY-MM-DD date): the routes answer 404.
// An empty file is a Night with no rows: "nothing ran".
export type ReadNight = (runsDir: string, night: string) => Night | null;
