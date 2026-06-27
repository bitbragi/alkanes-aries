// Admin tool: mint an Unkey API key for a customer tier.
//
//   npm run mint-key -- --tier pro --name "Acme Corp"
//   npm run mint-key -- --tier pro --name "Acme" --plugin            # paid add-on
//   npm run mint-key -- --tier production --name "Big Co"            # plugin bundled
//   npm run mint-key -- --tier enterprise --name "Whale" --rpm 2000 --daily 20000000
//
// Reads UNKEY_ROOT_KEY + UNKEY_API_ID from env (source the same env-file used to
// run aries-mcp). The new key is printed ONCE to stdout and never persisted.
//
// Metadata written: { tier:<slug>, pluginAccess:<bool>, [rpm], [daily] }.
//  - pluginAccess is DECOUPLED from limits:
//      production/enterprise -> always true (bundled; --plugin redundant).
//      hobby/builder/pro     -> true only with --plugin (the paid add-on).
//      free                  -> always false; --plugin on free is REJECTED.
//  - --rpm / --daily are optional per-key limit overrides (enterprise deals);
//    the server prefers them over the tier defaults. Plain tier keys carry none.
import { Unkey } from "@unkey/api";
import { TIERS, tier as resolveTier, tierIncludesPlugin } from "../src/auth.js";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}
function has(flag: string): boolean {
  return process.argv.includes(flag);
}
function die(msg: string): never {
  console.error(`mint-key: ${msg}`);
  process.exit(1);
}
function posInt(flag: string): number | undefined {
  const raw = arg(flag);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) die(`${flag} must be a positive integer`);
  return n;
}

const slug = (arg("--tier") ?? "").toLowerCase();
const name = arg("--name");
const owner = arg("--owner"); // optional externalId (customer id/label)
const prefix = arg("--prefix") ?? "aries";
const plugin = has("--plugin");
const rpm = posInt("--rpm");
const daily = posInt("--daily");

if (!slug || !(slug in TIERS)) {
  die(`--tier must be one of: ${Object.keys(TIERS).join(", ")}`);
}
if (!name) {
  die('--name "<label>" is required');
}

// Decoupled plugin-access resolution.
let pluginAccess: boolean;
if (tierIncludesPlugin(slug)) {
  pluginAccess = true; // production / enterprise: bundled
} else if (slug === "free") {
  if (plugin) die("the plugin add-on is not available on the free tier");
  pluginAccess = false;
} else {
  pluginAccess = plugin; // hobby / builder / pro: add-on only if purchased
}

const rootKey = process.env.UNKEY_ROOT_KEY;
const apiId = process.env.UNKEY_API_ID;
if (!rootKey || !apiId) {
  die("UNKEY_ROOT_KEY and UNKEY_API_ID must be set in the environment");
}

const meta: Record<string, unknown> = { tier: slug, pluginAccess };
if (rpm !== undefined) meta.rpm = rpm;
if (daily !== undefined) meta.daily = daily;

const unkey = new Unkey({ rootKey });
const res = await unkey.keys.createKey({
  apiId,
  prefix,
  name,
  ...(owner ? { externalId: owner } : {}),
  meta,
});

const key = res.data?.key;
const keyId = res.data?.keyId;
if (!key) {
  die("Unkey did not return a key (check root key / api id / network)");
}

const t = resolveTier(slug);
const eff = `${rpm ?? t.reqPerMin}/min, ${daily ?? t.dailyCap}/24h`;
console.error(
  `\nMinted ${t.display} (${slug}) key for "${name}"${owner ? ` [owner ${owner}]` : ""}\n` +
    `  limits: ${eff}${rpm || daily ? " (override)" : ""}   pluginAccess: ${pluginAccess}   keyId: ${keyId}`,
);
console.error("Give this key to the customer ONCE — it cannot be retrieved again:\n");
console.log(key);
