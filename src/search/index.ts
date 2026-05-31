import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import MiniSearch from "minisearch";
import { log } from "../log.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// dist/search/index.js -> repo root is two levels up
const ROOT = join(__dirname, "..", "..");
const CORPUS_DIR = join(ROOT, "corpus");

export interface Chunk {
  id: string; // `${path}#${anchor}`
  path: string; // relative path under corpus/, e.g. "subfrost/alkanes.md"
  source: string; // top-level dir, e.g. "subfrost"
  title: string; // doc title (frontmatter or first H1)
  heading: string; // the H2/H3 this chunk lives under ("" for preamble)
  anchor: string; // slugified heading
  body: string;
}

let CHUNKS: Chunk[] = [];
let INDEX: MiniSearch<Chunk> | null = null;

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith(".md")) out.push(full);
  }
  return out;
}

/** Split one markdown file into chunks by H2/H3 headings. */
function chunkFile(absPath: string): Chunk[] {
  const raw = readFileSync(absPath, "utf8");
  const rel = relative(CORPUS_DIR, absPath).split("\\").join("/");
  const source = rel.split("/")[0] ?? "misc";

  // Strip simple frontmatter, capture title.
  let title = rel;
  let content = raw;
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (fm) {
    const t = fm[1].match(/^title:\s*(.+)$/m);
    if (t) title = t[1].trim();
    content = raw.slice(fm[0].length);
  }
  const h1 = content.match(/^#\s+(.+)$/m);
  if (title === rel && h1) title = h1[1].trim();

  const lines = content.split("\n");
  const chunks: Chunk[] = [];
  let heading = "";
  let buf: string[] = [];

  const flush = () => {
    const body = buf.join("\n").trim();
    if (body) {
      const anchor = slug(heading) || "_intro";
      chunks.push({
        id: `${rel}#${anchor}`,
        path: rel,
        source,
        title,
        heading,
        anchor,
        body,
      });
    }
    buf = [];
  };

  for (const line of lines) {
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (m) {
      flush();
      heading = m[2].trim();
    } else {
      buf.push(line);
    }
  }
  flush();
  return chunks;
}

export function buildIndex(): void {
  const files = walk(CORPUS_DIR);
  CHUNKS = files.flatMap(chunkFile);
  INDEX = new MiniSearch<Chunk>({
    fields: ["title", "heading", "body"],
    storeFields: ["path", "source", "title", "heading", "anchor"],
    searchOptions: { boost: { heading: 3, title: 2 }, prefix: true, fuzzy: 0.2 },
  });
  INDEX.addAll(CHUNKS);
  log(`indexed ${CHUNKS.length} chunks from ${files.length} docs`);
}

export interface SearchHit {
  path: string;
  heading: string;
  source: string;
  preview: string;
}

export function search(query: string, limit = 8): SearchHit[] {
  if (!INDEX) buildIndex();
  return INDEX!.search(query)
    .slice(0, limit)
    .map((r) => {
      const c = CHUNKS.find((x) => x.id === r.id)!;
      return {
        path: c.path,
        heading: c.heading || "(intro)",
        source: c.source,
        preview: c.body.replace(/\s+/g, " ").slice(0, 220),
      };
    });
}

/** TOC (no section) or a single section's body (with section). */
export function doc(path: string, section?: string): string {
  if (!INDEX) buildIndex();
  const parts = CHUNKS.filter((c) => c.path === path);
  if (parts.length === 0) return `No corpus doc at "${path}".`;
  if (!section) {
    const headings = parts
      .filter((c) => c.heading)
      .map((c) => `- ${c.heading}`)
      .join("\n");
    return `# ${parts[0].title}\n(source: ${path})\n\nSections:\n${headings || "(single section)"}\n\nCall aries_doc again with a section name to read one.`;
  }
  const want = slug(section);
  const hit = parts.find(
    (c) => c.anchor === want || c.heading.toLowerCase() === section.toLowerCase(),
  );
  return hit ? `## ${hit.heading}\n\n${hit.body}` : `No section "${section}" in ${path}.`;
}

export function fullDoc(path: string): string {
  const abs = join(CORPUS_DIR, path);
  if (!existsSync(abs)) return `No corpus doc at "${path}".`;
  return readFileSync(abs, "utf8");
}

export function catalog(): Record<string, string[]> {
  const files = walk(CORPUS_DIR);
  const out: Record<string, string[]> = {};
  for (const f of files) {
    const rel = relative(CORPUS_DIR, f).split("\\").join("/");
    const src = rel.split("/")[0];
    (out[src] ??= []).push(rel);
  }
  return out;
}
