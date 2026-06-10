/**
 * Corpus ingest. Fetches each source, converts HTML -> markdown with turndown +
 * jsdom (targeting the main content node and stripping nav/ticker/footer
 * chrome), and writes corpus/<source>/<slug>.md with frontmatter. Raw *.md URLs
 * are written verbatim. Run on a machine with network access:
 *
 *   npm run ingest
 *
 * The MiniSearch index rebuilds from corpus/ at the next server start. Thin
 * extractions (e.g. JS-only SPA shells) are skipped so they don't pollute search.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS = join(ROOT, "corpus");
const UA =
  "Mozilla/5.0 (compatible; AriesBot/1.0; +https://github.com/bitbragi/alkanes-aries)";
const MIN_CHARS = 200; // skip near-empty extractions (e.g. JS-rendered SPA shells)

interface Source {
  source: string; // corpus subdir
  slug: string; // file name (no ext)
  url: string;
}

const td = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});
td.remove(["script", "style", "noscript", "nav", "footer", "form", "svg", "iframe"]);

// Non-content containers (by class/id token) seen across the source sites.
const JUNK =
  /(^|\s)(navbar|ticker-bar|tut-toc|tut-breadcrumb|tut-nav-footer|footer|sidebar|site-header|cookie|tab-btn|tab-strip|code-toolbar|code-copy|code-lang)(\s|$)/i;
// Preferred content containers; first non-trivial match wins.
const CONTENT = [
  ".tut-page",
  "main",
  "article",
  "#content",
  ".content",
  ".markdown-body",
  ".doc-content",
];

function extract(html: string, url: string): { title: string; markdown: string } {
  const { document } = new JSDOM(html, { url }).window;
  document
    .querySelectorAll("script,style,noscript,nav,footer,svg,form,iframe")
    .forEach((el) => el.remove());
  document.querySelectorAll("[class],[id]").forEach((el) => {
    const token = `${el.getAttribute("class") || ""} ${el.getAttribute("id") || ""}`;
    if (JUNK.test(token)) el.remove();
  });

  let node: Element | null = null;
  for (const sel of CONTENT) {
    const n = document.querySelector(sel);
    if (n && (n.textContent || "").trim().length > MIN_CHARS) {
      node = n;
      break;
    }
  }
  const root = node ?? document.body;
  const title = (
    root.querySelector("h1")?.textContent ||
    document.querySelector("title")?.textContent ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
  const markdown = td.turndown(root.innerHTML).replace(/\n{3,}/g, "\n\n").trim();
  return { title, markdown };
}

function firstMdHeading(md: string): string {
  return (md.match(/^#\s+(.+)$/m)?.[1] ?? "").trim();
}

const CODE_LANG: Record<string, string> = {
  rs: "rust",
  toml: "toml",
  ts: "typescript",
  js: "javascript",
  json: "json",
};

/** A source is "raw text" if it's a .md/.rs/.toml/... file or a raw GitHub URL. */
function isRawText(url: string): boolean {
  return /\.(md|rs|toml|txt|json)(\?|$)/i.test(url) || url.includes("raw.githubusercontent.com");
}

/** Wrap a raw file as markdown: .md verbatim; code/text fenced under an H1 so it
 *  indexes as a clean, titled chunk. */
function rawDoc(url: string, slug: string, raw: string): { title: string; body: string } {
  const ext = (url.split("?")[0].split(".").pop() ?? "").toLowerCase();
  if (ext === "md") {
    const body = raw.trim();
    return { title: firstMdHeading(body) || slug, body };
  }
  const lang = CODE_LANG[ext] ?? "";
  const fenced = raw.replace(/```/g, "ʼʼʼ").trimEnd();
  return { title: slug, body: `# ${slug}\n\n\`\`\`${lang}\n${fenced}\n\`\`\`\n` };
}

// Expand this list freely. HTML pages are cleaned via extract(); *.md URLs are
// taken verbatim.
const SOURCES: Source[] = [
  // Subfrost protocol docs
  { source: "subfrost", slug: "technical-overview", url: "https://docs.subfrost.io/introduction/technical-overview" },
  { source: "subfrost", slug: "alkanes-integration", url: "https://docs.subfrost.io/developer-guide/alkanes-integration" },
  { source: "subfrost", slug: "key-components-alkanes", url: "https://docs.subfrost.io/key-components/alkanes" },
  { source: "subfrost", slug: "subfrost-node-cli-reference", url: "https://docs.subfrost.io/reference/subfrost-node-cli-reference" },
  { source: "subfrost", slug: "frost-and-roast", url: "https://docs.subfrost.io/key-components/frost-and-roast" },
  { source: "subfrost", slug: "schnorr-signatures", url: "https://docs.subfrost.io/key-components/schnorr-signatures" },
  { source: "subfrost", slug: "wrapping-frbtc", url: "https://docs.subfrost.io/developer-guide/wrapping-frBTC" },
  { source: "subfrost", slug: "frbtc-overview", url: "https://docs.subfrost.io/tokens/frBTC-overview" },
  { source: "subfrost", slug: "dxbtc", url: "https://docs.subfrost.io/tokens/dxBTC" },
  { source: "subfrost", slug: "fuel-token", url: "https://docs.subfrost.io/tokens/FUEL-token" },
  // Subfrost API reference
  { source: "subfrost-api", slug: "jsonrpc-metashrew", url: "https://api.subfrost.io/docs/jsonrpc/metashrew" },
  { source: "subfrost-api", slug: "jsonrpc-esplora", url: "https://api.subfrost.io/docs/jsonrpc/esplora" },
  { source: "subfrost-api", slug: "jsonrpc-ord", url: "https://api.subfrost.io/docs/jsonrpc/ord" },
  { source: "subfrost-api", slug: "jsonrpc-bitcoind", url: "https://api.subfrost.io/docs/jsonrpc/bitcoind" },
  { source: "subfrost-api", slug: "rest-alkanes", url: "https://api.subfrost.io/docs/rest/alkanes" },
  { source: "subfrost-api", slug: "rest-pools", url: "https://api.subfrost.io/docs/rest/pools" },
  { source: "subfrost-api", slug: "authentication", url: "https://api.subfrost.io/docs/authentication" },
  { source: "subfrost-api", slug: "rate-limits", url: "https://api.subfrost.io/docs/platform/rate-limits" },
  // alkanes-rs
  { source: "alkanes-rs", slug: "readme", url: "https://raw.githubusercontent.com/kungfuflex/alkanes-rs/main/README.md" },
  // AlkaneScan tutorials (alkanescan.org/tutorials) — server-rendered, content in .tut-page
  { source: "tutorials", slug: "what-is-alkanes", url: "https://alkanescan.org/tutorials/tutorial-what-is-alkanes.php" },
  { source: "tutorials", slug: "make-smart-contract", url: "https://alkanescan.org/tutorials/tutorial-smart-contract.php" },
  { source: "tutorials", slug: "audit-smart-contract", url: "https://alkanescan.org/tutorials/tutorial-audit.php" },
  { source: "tutorials", slug: "make-oracle", url: "https://alkanescan.org/tutorials/tutorial-oracle.php" },
  { source: "tutorials", slug: "make-dao", url: "https://alkanescan.org/tutorials/tutorial-dao.php" },
  { source: "tutorials", slug: "make-token", url: "https://alkanescan.org/tutorials/tutorial-token.php" },
  { source: "tutorials", slug: "deploy-contract", url: "https://alkanescan.org/tutorials/tutorial-deploy.php" },
  { source: "tutorials", slug: "buy-diesel", url: "https://alkanescan.org/tutorials/tutorial-buy-diesel.php" },
  { source: "tutorials", slug: "mint-diesel", url: "https://alkanescan.org/tutorials/tutorial-mint-diesel.php" },
  { source: "tutorials", slug: "espo-track-activity", url: "https://alkanescan.org/tutorials/tutorial-espo.php" },
  { source: "tutorials", slug: "view-on-ordiscan", url: "https://alkanescan.org/tutorials/tutorial-ordiscan.php" },
  { source: "tutorials", slug: "frbtc-and-subfrost", url: "https://alkanescan.org/tutorials/tutorial-frbtc-subfrost.php" },
  { source: "tutorials", slug: "make-stablecoin", url: "https://alkanescan.org/tutorials/tutorial-stablecoin.php" },
  { source: "tutorials", slug: "alkanes-vs-brc20", url: "https://alkanescan.org/tutorials/tutorial-alkanes-vs-brc20.php" },
  { source: "tutorials", slug: "alkanes-vs-runes", url: "https://alkanescan.org/tutorials/tutorial-alkanes-vs-runes.php" },
  { source: "tutorials", slug: "swap-on-subfrost", url: "https://alkanescan.org/tutorials/tutorial-swap-subfrost.php" },
  { source: "tutorials", slug: "swap-on-idclub", url: "https://alkanescan.org/tutorials/tutorial-swap-idclub.php" },
  { source: "tutorials", slug: "security-issues", url: "https://alkanescan.org/tutorials/tutorial-security-issues.php" },
  { source: "tutorials", slug: "indexers", url: "https://alkanescan.org/tutorials/tutorial-indexers.php" },
  { source: "tutorials", slug: "wrapped-brc20-token", url: "https://alkanescan.org/tutorials/tutorial-wrapped-token.php" },
  { source: "tutorials", slug: "build-an-amm", url: "https://alkanescan.org/tutorials/tutorial-amm.php" },
  // AlkaneScan oracle reference pages (alkanescan.org) — patterns + interfaces
  { source: "oracles", slug: "overview", url: "https://alkanescan.org/oracles.php" },
  { source: "oracles", slug: "price-feed", url: "https://alkanescan.org/oracle-price-feed.php" },
  { source: "oracles", slug: "block-header", url: "https://alkanescan.org/oracle-block-header.php" },
  { source: "oracles", slug: "random-number", url: "https://alkanescan.org/oracle.php?id=random" },
  { source: "oracles", slug: "delay-vault", url: "https://alkanescan.org/oracle-delay-vault.php" },
  // orddao reference contracts (READMEs, raw markdown)
  { source: "orddao", slug: "block-header-oracle", url: "https://raw.githubusercontent.com/orddao/Block-Header-Oracle/main/README.md" },
  { source: "orddao", slug: "stocks-price-oracle", url: "https://raw.githubusercontent.com/orddao/Stocks-price-oracle-smart-contract-for-Alkanes-/main/README.md" },
  { source: "orddao", slug: "btc-prediction-market", url: "https://raw.githubusercontent.com/orddao/BTC-price-prediction-market-for-alkanes/main/README.md" },
  { source: "orddao", slug: "ico-existing-token", url: "https://raw.githubusercontent.com/orddao/Alkanes-ICO-contract-for-exist-token/main/README.md" },
  { source: "orddao", slug: "ico-btc-or-diesel", url: "https://raw.githubusercontent.com/orddao/ICO-contract---Alkanescan/main/README.md" },
  { source: "orddao", slug: "panda-strategy", url: "https://raw.githubusercontent.com/orddao/PandaStrategy/main/README.md" },
  // Orbitals — Alkanes NFTs (a Token with total supply 1 + opcode 1000 = media)
  { source: "orbitals", slug: "std-orbital", url: "https://raw.githubusercontent.com/kungfuflex/alkanes-rs/main/crates/alkanes-std-orbital/src/lib.rs" },
  { source: "orbitals", slug: "launchpad-readme", url: "https://raw.githubusercontent.com/0xsupersimon/nft-launchpad-alkanes/main/README.md" },
  { source: "orbitals", slug: "collection-contract", url: "https://raw.githubusercontent.com/0xsupersimon/nft-launchpad-alkanes/main/alkanes-collection/src/lib.rs" },
  { source: "orbitals", slug: "nft-contract", url: "https://raw.githubusercontent.com/0xsupersimon/nft-launchpad-alkanes/main/alkanes-nft/src/lib.rs" },
  { source: "orbitals", slug: "svg-generator", url: "https://raw.githubusercontent.com/0xsupersimon/nft-launchpad-alkanes/main/nft-generator/src/svg_generator.rs" },
];

async function run(): Promise<void> {
  let wrote = 0;
  let skipped = 0;
  for (const s of SOURCES) {
    try {
      const res = await fetch(s.url, { headers: { "user-agent": UA } });
      if (!res.ok) {
        console.error(`skip  ${s.source}/${s.slug}: HTTP ${res.status}`);
        skipped++;
        continue;
      }
      const raw = await res.text();
      let title: string;
      let body: string;
      if (isRawText(s.url)) {
        const r = rawDoc(s.url, s.slug, raw);
        title = r.title;
        body = r.body;
      } else {
        const ex = extract(raw, s.url);
        body = ex.markdown;
        title = ex.title || s.slug;
      }
      if (body.length < MIN_CHARS) {
        console.error(`skip  ${s.source}/${s.slug}: thin (${body.length} chars) — JS-rendered?`);
        skipped++;
        continue;
      }
      const dir = join(CORPUS, s.source);
      mkdirSync(dir, { recursive: true });
      const fm = `---\ntitle: ${title}\nsource: ${s.source}\nsource_url: ${s.url}\n---\n\n`;
      writeFileSync(join(dir, `${s.slug}.md`), fm + body, "utf8");
      console.error(`wrote ${s.source}/${s.slug}.md  (${body.length} chars)  "${title}"`);
      wrote++;
    } catch (e) {
      console.error(`error ${s.source}/${s.slug}:`, String(e));
      skipped++;
    }
  }
  console.error(`\ningest: ${wrote} written, ${skipped} skipped of ${SOURCES.length}`);
}

run();
