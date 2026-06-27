// Incident-learning store with a trust quarantine.
//
// Collection is DECOUPLED from trust. New submissions land in a PENDING queue,
// unvetted, carrying attribution (submitting keyId + agent_id + timestamp). An
// operator reviews them (scripts/incidents.ts) and promotes the good ones into
// the TRUSTED corpus. Only the TRUSTED corpus is served by aries_incident_query.
//
// Both stores are append-only JSONL under the persistent data dir (ARIES_DATA_DIR,
// bind-mounted to /data in prod). Reports are sanitized of obvious secrets/paths
// on EVERY write path (submission + seed import), so the corpus is safe to share.
import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// dist/incidents.js -> repo root is one level up
const ROOT = join(__dirname, "..");

// Persistent data dir. In prod ARIES_DATA_DIR=/data (a bind-mount); locally it
// falls back to the repo's gitignored data/ dir so stdio dev is unchanged.
const DATA_DIR = process.env.ARIES_DATA_DIR ?? join(ROOT, "data");
const TRUSTED = process.env.ARIES_TRUSTED_PATH ?? join(DATA_DIR, "incidents-trusted.jsonl");
const PENDING = process.env.ARIES_PENDING_PATH ?? join(DATA_DIR, "incidents-pending.jsonl");

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Category =
  | "security"
  | "bad_code"
  | "rule_violation"
  | "exploit"
  | "misunderstanding"
  | "performance"
  | "data_loss";
export type Status = "pending" | "trusted";

export interface IncidentInput {
  severity: Severity;
  category: Category;
  title: string;
  description: string;
  root_cause: string;
  correction: string;
  rules_violated?: string;
  affected_files?: string;
  bad_code?: string;
  tags?: string;
  agent_id?: string;
}

export interface Incident extends IncidentInput {
  id: string;
  ts: number; // unix ms
  status: Status;
  key_id?: string; // submitting Unkey keyId (attribution); absent for local/stdio + seed
  source?: string; // provenance, e.g. "submission" | "seed:dev"
}

/** Attribution context threaded from the auth seam down to a submission. */
export interface ReportContext {
  keyId?: string;
}

const SECRET_KV =
  /\b([A-Za-z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|SEED|MNEMONIC|PRIV(?:ATE)?[_-]?KEY)[A-Za-z0-9_]*)\s*[:=]\s*["']?[^\s"',]+["']?/gi;
const USER_PATH = /([A-Za-z]:\\Users\\|\/Users\/|\/home\/|\/root\/)[^\s"':,;)]+/g;

/** Best-effort scrub of credentials / local paths before storage. Reports are
 *  treated as shareable — never persist secrets, keys, seed phrases, or paths. */
export function sanitize(text: string): string {
  let t = text;
  const key = process.env.SUBFROST_API_KEY;
  if (key && key.length >= 8) t = t.split(key).join("<SUBFROST_API_KEY>");
  t = t.replace(SECRET_KV, "$1=<REDACTED>");
  t = t.replace(/(x-subfrost-api-key\s*:\s*)\S+/gi, "$1<REDACTED>");
  t = t.replace(/\b(?:xprv|xpub|tprv|tpub)[A-Za-z0-9]{20,}\b/g, "<KEY_REDACTED>");
  t = t.replace(USER_PATH, "$1<USER_PATH>");
  t = t.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "<IP>");
  return t;
}

function sanitizeOpt(text?: string): string | undefined {
  return text === undefined || text === "" ? text : sanitize(text);
}

/** Apply sanitize() to every free-text field of an incident-shaped object. */
function sanitizeFields<T extends IncidentInput>(input: T): T {
  return {
    ...input,
    title: sanitize(input.title),
    description: sanitize(input.description),
    root_cause: sanitize(input.root_cause),
    correction: sanitize(input.correction),
    rules_violated: sanitizeOpt(input.rules_violated),
    affected_files: sanitizeOpt(input.affected_files),
    bad_code: sanitizeOpt(input.bad_code),
  };
}

function loadFile(path: string): Incident[] {
  if (!existsSync(path)) return [];
  const out: Incident[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      out.push(JSON.parse(s) as Incident);
    } catch {
      /* skip a corrupt line rather than fail the whole store */
    }
  }
  return out;
}

function appendLine(path: string, inc: Incident): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(inc) + "\n", "utf8");
}

/** Rewrite a store in full (used by promote/reject, which remove a line). */
function writeAll(path: string, incidents: Incident[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, incidents.map((i) => JSON.stringify(i)).join("\n") + (incidents.length ? "\n" : ""), "utf8");
}

function loadTrusted(): Incident[] {
  return loadFile(TRUSTED);
}
function loadPending(): Incident[] {
  return loadFile(PENDING);
}

/** Trusted-corpus size (what aries_incident_query serves). */
export function incidentCount(): number {
  return loadTrusted().length;
}
/** Pending-queue size (awaiting operator review). */
export function pendingCount(): number {
  return loadPending().length;
}

export function storePaths(): { dataDir: string; trusted: string; pending: string } {
  return { dataDir: DATA_DIR, trusted: TRUSTED, pending: PENDING };
}

function nextId(): string {
  const ts = Date.now();
  const seq = loadTrusted().length + loadPending().length + 1;
  return `INC-${ts.toString(36)}-${seq.toString(36)}`;
}

/**
 * File a new incident. ALWAYS lands in the PENDING queue (status=pending) with
 * attribution — never directly into the trusted corpus. Sanitized on the way in.
 */
export function report(input: IncidentInput, ctx: ReportContext = {}): Incident {
  const clean = sanitizeFields(input);
  const incident: Incident = {
    id: nextId(),
    ts: Date.now(),
    status: "pending",
    key_id: ctx.keyId,
    source: "submission",
    severity: clean.severity,
    category: clean.category,
    title: clean.title,
    description: clean.description,
    root_cause: clean.root_cause,
    correction: clean.correction,
    rules_violated: clean.rules_violated,
    affected_files: clean.affected_files,
    bad_code: clean.bad_code,
    tags: clean.tags,
    agent_id: clean.agent_id,
  };
  appendLine(PENDING, incident);
  return incident;
}

export interface QueryOpts {
  action?: "recent" | "search" | "stats" | "get";
  search_text?: string;
  tags?: string;
  category?: Category;
  severity?: Severity;
  incident_id?: string;
  affected_files?: string;
  limit?: number;
}

const SEV_RANK: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

/** Query the TRUSTED corpus only. Pending submissions are never served here. */
export function query(opts: QueryOpts): unknown {
  const all = loadTrusted();
  const action = opts.action ?? "recent";

  if (action === "get") {
    return all.find((i) => i.id === opts.incident_id) ?? { error: `No incident ${opts.incident_id ?? ""}` };
  }
  if (action === "stats") {
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    for (const i of all) {
      byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
      bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
    }
    return { total: all.length, byCategory, bySeverity };
  }

  let results = all;
  if (opts.category) results = results.filter((i) => i.category === opts.category);
  if (opts.severity) {
    const min = SEV_RANK[opts.severity];
    results = results.filter((i) => SEV_RANK[i.severity] >= min);
  }
  if (opts.tags) {
    const want = opts.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    results = results.filter((i) => want.some((w) => (i.tags ?? "").toLowerCase().includes(w)));
  }
  if (opts.affected_files) {
    const want = opts.affected_files.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    results = results.filter((i) => want.some((w) => (i.affected_files ?? "").toLowerCase().includes(w)));
  }
  if (action === "search" && opts.search_text) {
    const q = opts.search_text.toLowerCase();
    results = results.filter((i) =>
      `${i.title} ${i.description} ${i.root_cause} ${i.correction} ${i.tags ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }
  const limit = Math.min(opts.limit ?? 10, 50);
  results = results.slice().sort((a, b) => b.ts - a.ts).slice(0, limit);
  return { count: results.length, total: all.length, incidents: results };
}

// ── Operator review API (used by scripts/incidents.ts; never the public endpoint) ──

/** All pending submissions, newest first, WITH attribution for the operator. */
export function listPending(): Incident[] {
  return loadPending().slice().sort((a, b) => b.ts - a.ts);
}

/** All trusted incidents, newest first. */
export function listTrusted(): Incident[] {
  return loadTrusted().slice().sort((a, b) => b.ts - a.ts);
}

/** Promote one pending incident into the trusted corpus. */
export function promote(id: string): { ok: boolean; incident?: Incident; error?: string } {
  const pending = loadPending();
  const idx = pending.findIndex((i) => i.id === id);
  if (idx < 0) return { ok: false, error: `No pending incident ${id}` };
  const [inc] = pending.splice(idx, 1);
  const promoted: Incident = { ...inc, status: "trusted" };
  appendLine(TRUSTED, promoted);
  writeAll(PENDING, pending);
  return { ok: true, incident: promoted };
}

/** Drop one pending incident without trusting it. */
export function reject(id: string): { ok: boolean; error?: string } {
  const pending = loadPending();
  const next = pending.filter((i) => i.id !== id);
  if (next.length === pending.length) return { ok: false, error: `No pending incident ${id}` };
  writeAll(PENDING, next);
  return { ok: true };
}

/** Batch-promote the entire pending queue (operator trusts a whole session). */
export function promoteAll(): { promoted: number } {
  const pending = loadPending();
  if (!pending.length) return { promoted: 0 };
  for (const inc of pending) appendLine(TRUSTED, { ...inc, status: "trusted" });
  writeAll(PENDING, []);
  return { promoted: pending.length };
}

/**
 * Import already-vetted incidents straight into the TRUSTED corpus (seeding).
 * Re-sanitizes every field, stamps provenance, preserves id/ts when present.
 * Returns the number imported.
 */
export function importTrusted(raw: Array<Partial<Incident> & IncidentInput>, source = "seed:dev"): number {
  const existing = loadTrusted();
  const seen = new Set(existing.map((i) => i.id));
  let n = 0;
  for (const item of raw) {
    const clean = sanitizeFields(item);
    const ts = typeof item.ts === "number" ? item.ts : Date.now();
    const id = item.id ?? `INC-${ts.toString(36)}-seed${existing.length + n + 1}`;
    if (seen.has(id)) continue; // idempotent re-seed
    seen.add(id);
    const inc: Incident = {
      id,
      ts,
      status: "trusted",
      source: item.source ?? source,
      key_id: item.key_id,
      severity: clean.severity,
      category: clean.category,
      title: clean.title,
      description: clean.description,
      root_cause: clean.root_cause,
      correction: clean.correction,
      rules_violated: clean.rules_violated,
      affected_files: clean.affected_files,
      bad_code: clean.bad_code,
      tags: clean.tags,
      agent_id: clean.agent_id,
    };
    appendLine(TRUSTED, inc);
    n++;
  }
  return n;
}
