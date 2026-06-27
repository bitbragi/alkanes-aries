// Operator review tool for the incident quarantine — the human quality gate.
//
// Operates DIRECTLY on the persistent /data JSONL files (never the public MCP
// endpoint). Point it at the same data dir the container mounts:
//
//   ARIES_DATA_DIR=/home/bragi/aries-data npm run incidents -- list-pending
//   ARIES_DATA_DIR=/home/bragi/aries-data npm run incidents -- promote <id>
//   ARIES_DATA_DIR=/home/bragi/aries-data npm run incidents -- reject <id>
//   ARIES_DATA_DIR=/home/bragi/aries-data npm run incidents -- promote-all
//   ARIES_DATA_DIR=/home/bragi/aries-data npm run incidents -- list-trusted
//   ARIES_DATA_DIR=/home/bragi/aries-data npm run incidents -- import-seed [path]
//
// list-pending shows attribution (submitting keyId, agent_id, timestamp) so the
// operator can judge each submission before promoting it into the trusted corpus.
import { readFileSync } from "node:fs";
import {
  listPending,
  listTrusted,
  promote,
  reject,
  promoteAll,
  importTrusted,
  incidentCount,
  pendingCount,
  storePaths,
  type Incident,
  type IncidentInput,
} from "../src/incidents.js";

function die(msg: string): never {
  console.error(`incidents: ${msg}`);
  process.exit(1);
}

function fmt(i: Incident): string {
  const when = new Date(i.ts).toISOString();
  const who = i.key_id ? `key=${i.key_id}` : "key=<none>";
  const agent = i.agent_id ? ` agent=${i.agent_id}` : "";
  const src = i.source ? ` src=${i.source}` : "";
  return (
    `${i.id}  [${i.severity}/${i.category}]  ${when}  ${who}${agent}${src}\n` +
    `  title:       ${i.title}\n` +
    `  description: ${i.description}\n` +
    `  root_cause:  ${i.root_cause}\n` +
    `  correction:  ${i.correction}` +
    (i.rules_violated ? `\n  rules:       ${i.rules_violated}` : "") +
    (i.affected_files ? `\n  files:       ${i.affected_files}` : "") +
    (i.tags ? `\n  tags:        ${i.tags}` : "")
  );
}

const [cmd, arg] = process.argv.slice(2);
const paths = storePaths();

switch (cmd) {
  case "list-pending": {
    const items = listPending();
    console.error(`PENDING queue (${items.length}) — ${paths.pending}\n`);
    if (!items.length) console.error("(empty)");
    for (const i of items) console.log(fmt(i) + "\n");
    break;
  }
  case "list-trusted": {
    const items = listTrusted();
    console.error(`TRUSTED corpus (${items.length}) — ${paths.trusted}\n`);
    if (!items.length) console.error("(empty)");
    for (const i of items) console.log(fmt(i) + "\n");
    break;
  }
  case "promote": {
    if (!arg) die("promote <id> requires an incident id");
    const r = promote(arg);
    if (!r.ok) die(r.error ?? "promote failed");
    console.error(`promoted ${arg} -> trusted (${incidentCount()} trusted, ${pendingCount()} pending)`);
    break;
  }
  case "reject": {
    if (!arg) die("reject <id> requires an incident id");
    const r = reject(arg);
    if (!r.ok) die(r.error ?? "reject failed");
    console.error(`rejected ${arg} (dropped from pending; ${pendingCount()} pending left)`);
    break;
  }
  case "promote-all": {
    const r = promoteAll();
    console.error(`promoted ${r.promoted} pending -> trusted (${incidentCount()} trusted, ${pendingCount()} pending)`);
    break;
  }
  case "import-seed": {
    const path = arg ?? "data/incidents.jsonl";
    let raw: Array<Partial<Incident> & IncidentInput>;
    try {
      raw = readFileSync(path, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => JSON.parse(l));
    } catch (e) {
      die(`could not read seed file ${path}: ${String(e)}`);
    }
    const n = importTrusted(raw, "seed:dev");
    console.error(`imported ${n} incident(s) from ${path} into TRUSTED (now ${incidentCount()} trusted)`);
    break;
  }
  case "counts": {
    console.error(`trusted=${incidentCount()} pending=${pendingCount()}  data=${paths.dataDir}`);
    break;
  }
  default:
    die(
      "usage: incidents -- <list-pending|list-trusted|promote <id>|reject <id>|promote-all|import-seed [path]|counts>",
    );
}
