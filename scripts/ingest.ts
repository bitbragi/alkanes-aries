/**
 * Corpus ingest. Run on a machine that can reach docs.subfrost.io,
 * api.subfrost.io, and raw.githubusercontent.com:
 *
 *   npm run ingest
 *
 * Fetches each source page, strips it to text, and writes a markdown file
 * under corpus/<source>/<slug>.md with frontmatter. Then `npm run build`
 * re-indexes on next server start (the index is built at startup).
 *
 * This is deliberately simple (HTML -> rough markdown). For higher-fidelity
 * extraction, swap the `htmlToText` function for a real converter like
 * `turndown` + `jsdom`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = join(ROOT, "corpus");

interface Source {
  source: string; // corpus subdir
  slug: string; // file name (no ext)
  url: string;
}

// Expand this list freely — these are the high-value pages.
const SOURCES: Source[] = [
  { source: "subfrost", slug: "technical-overview", url: "https://docs.subfrost.io/introduction/technical-overview" },
  { source: "subfrost", slug: "frost-and-roast", url: "https://docs.subfrost.io/key-components/frost-and-roast" },
  { source: "subfrost", slug: "schnorr-signatures", url: "https://docs.subfrost.io/key-components/schnorr-signatures" },
  { source: "subfrost", slug: "wrapping-frbtc", url: "https://docs.subfrost.io/developer-guide/wrapping-frBTC" },
  { source: "subfrost", slug: "frbtc-overview", url: "https://docs.subfrost.io/tokens/frBTC-overview" },
  { source: "subfrost", slug: "dxbtc", url: "https://docs.subfrost.io/tokens/dxBTC" },
  { source: "subfrost", slug: "fuel-token", url: "https://docs.subfrost.io/tokens/FUEL-token" },
  { source: "subfrost-api", slug: "jsonrpc-metashrew", url: "https://api.subfrost.io/docs/jsonrpc/metashrew" },
  { source: "subfrost-api", slug: "jsonrpc-esplora", url: "https://api.subfrost.io/docs/jsonrpc/esplora" },
  { source: "subfrost-api", slug: "jsonrpc-ord", url: "https://api.subfrost.io/docs/jsonrpc/ord" },
  { source: "subfrost-api", slug: "jsonrpc-bitcoind", url: "https://api.subfrost.io/docs/jsonrpc/bitcoind" },
  { source: "subfrost-api", slug: "rest-alkanes", url: "https://api.subfrost.io/docs/rest/alkanes" },
  { source: "subfrost-api", slug: "rest-pools", url: "https://api.subfrost.io/docs/rest/pools" },
  { source: "subfrost-api", slug: "authentication", url: "https://api.subfrost.io/docs/authentication" },
  { source: "subfrost-api", slug: "rate-limits", url: "https://api.subfrost.io/docs/platform/rate-limits" },
  { source: "alkanes-rs", slug: "readme", url: "https://raw.githubusercontent.com/kungfuflex/alkanes-rs/master/README.md" },
];

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function run(): Promise<void> {
  for (const s of SOURCES) {
    try {
      const res = await fetch(s.url);
      if (!res.ok) {
        console.error(`skip ${s.url}: HTTP ${res.status}`);
        continue;
      }
      const raw = await res.text();
      const body = s.url.endsWith(".md") ? raw : htmlToText(raw);
      const dir = join(CORPUS, s.source);
      mkdirSync(dir, { recursive: true });
      const fm = `---\ntitle: ${s.slug}\nsource_url: ${s.url}\n---\n\n`;
      writeFileSync(join(dir, `${s.slug}.md`), fm + body, "utf8");
      console.error(`wrote ${s.source}/${s.slug}.md (${body.length} chars)`);
    } catch (e) {
      console.error(`error ${s.url}:`, String(e));
    }
  }
}

run();
