import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { rpc, restPost, assertAllowed, hasApiKey } from "../rpc.js";
import { NUDGE_OK, NUDGE_ERR } from "./nudge.js";

// The report-back nudge rides as a SEPARATE text block after the JSON result, so
// the structured output (always content[0]) is never corrupted.
const ok = (data: unknown) => ({
  content: [
    { type: "text" as const, text: JSON.stringify(data, null, 2) },
    NUDGE_OK,
  ],
});
const fail = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }, NUDGE_ERR],
  isError: true,
});

// frBTC contract is the alkane at block 32, tx 0. Opcode views (verified live
// and against subfrost/alkanes-rs tests): 99 = name, 100 = symbol,
// 102 = decimals, 103 = get-signer, 105 = total supply. (77 = wrap, 78 = unwrap.)
const FRBTC = { block: 32, tx: 0 };

interface SimResult {
  execution?: { data?: string; error?: string | null };
  status?: number;
  gasUsed?: number;
}

/** Invoke a contract opcode as a read-only view via alkanes_simulate.
 *  The opcode + any args go in the cellpack `inputs` (NOT `data`); `target`
 *  names the alkane, so no [block,tx] prefix is needed. */
function simulateOpcode(
  id: { block: number; tx: number },
  opcode: number,
  args: number[] = [],
  blockTag = "latest",
): Promise<SimResult> {
  return rpc<SimResult>("alkanes_simulate", [
    {
      alkaneId: id,
      target: id,
      inputs: [opcode, ...args],
      pointer: 0,
      refundPointer: 0,
      vout: 0,
      data: "0x",
    },
    blockTag,
  ]);
}

/** Decode a "0x…" hex string returned by a view into UTF-8 text. */
function hexToUtf8(hex?: string): string {
  if (!hex || hex === "0x") return "";
  return Buffer.from(hex.replace(/^0x/, ""), "hex").toString("utf8");
}

/** Read `len` little-endian bytes at byte offset `start` of a hex string (no 0x). */
function leUint(hexNo0x: string, start: number, len: number): bigint {
  let n = 0n;
  for (let i = len - 1; i >= 0; i--) {
    const byte = hexNo0x.slice((start + i) * 2, (start + i) * 2 + 2);
    n = (n << 8n) | BigInt(parseInt(byte || "0", 16));
  }
  return n;
}

/** Decode a "0x…" little-endian u128 hex string into a decimal string. */
function hexToU128(hex?: string): string {
  if (!hex || hex === "0x") return "0";
  const b = hex.replace(/^0x/, "");
  return leUint(b, 0, b.length / 2).toString();
}

type Decode = "raw" | "u128" | "u64" | "u32" | "utf8" | "bool" | "price";

/** Decode an oracle/view's execution.data per a hint. */
function decodeData(hex: string | undefined, how: Decode): unknown {
  const h = (hex ?? "0x").replace(/^0x/, "");
  switch (how) {
    case "utf8":
      return hexToUtf8(hex);
    case "bool":
      return h.length >= 2 && parseInt(h.slice(0, 2), 16) !== 0;
    case "u128":
    case "u64":
    case "u32":
      return hexToU128(hex);
    case "price":
      return {
        priceE8: leUint(h, 0, 16).toString(),
        price: Number(leUint(h, 0, 16)) / 1e8,
        priceBlock: Number(leUint(h, 16, 8)),
        updatedBlock: Number(leUint(h, 24, 8)),
      };
    case "raw":
    default:
      return hex ?? "0x";
  }
}

interface TokenMeta {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string | null;
  supplyOpcode: number | null;
  note?: string;
}

/** Read an alkane's basic token metadata via opcode views. Handles the common
 *  variants: name=99, symbol=100, decimals=102, total supply at 105 (e.g. frBTC)
 *  or 101 (e.g. the orbital standard). */
async function readToken(
  id: { block: number; tx: number },
  blockTag = "latest",
): Promise<TokenMeta> {
  const safe = (p: Promise<SimResult>) =>
    p.catch((e): SimResult => ({ execution: { data: "0x", error: String(e) } }));
  const [n, s, d, s101, s105] = await Promise.all([
    safe(simulateOpcode(id, 99, [], blockTag)),
    safe(simulateOpcode(id, 100, [], blockTag)),
    safe(simulateOpcode(id, 102, [], blockTag)),
    safe(simulateOpcode(id, 101, [], blockTag)),
    safe(simulateOpcode(id, 105, [], blockTag)),
  ]);
  const sup105 = hexToU128(s105.execution?.data);
  const sup101 = hexToU128(s101.execution?.data);
  const supplyOpcode = sup105 !== "0" ? 105 : sup101 !== "0" ? 101 : null;
  const totalSupply = supplyOpcode === null ? null : sup105 !== "0" ? sup105 : sup101;
  const meta: TokenMeta = {
    id: `${id.block}:${id.tx}`,
    name: hexToUtf8(n.execution?.data),
    symbol: hexToUtf8(s.execution?.data),
    decimals: Number(hexToU128(d.execution?.data)),
    totalSupply,
    supplyOpcode,
  };
  if (totalSupply === "1") {
    meta.note = "totalSupply is 1 — likely an Orbital/NFT; try aries_oracle_read opcode 1000 for media.";
  } else if (supplyOpcode === null) {
    meta.note = "supply not exposed via opcode 101/105 — this contract may use a different scheme (probe with aries_simulate).";
  }
  return meta;
}

export function registerChainTools(server: McpServer): void {
  server.registerTool(
    "aries_tokens_by_address",
    {
      description:
        "List all Alkanes tokens held by a Bitcoin address (wraps alkanes_protorunesbyaddress, protocolTag is always 1). Returns outpoints and the rune balances at each. Note: very high-activity addresses (thousands of UTXOs, e.g. the frBTC treasury) can exceed the RPC timeout.",
      inputSchema: {
        address: z.string().describe("Bitcoin address, e.g. bc1q…/bc1p…"),
        blockTag: z
          .string()
          .optional()
          .describe('Block tag, default "latest"'),
      },
    },
    async ({ address, blockTag }) => {
      try {
        const result = await rpc("alkanes_protorunesbyaddress", [
          { address, protocolTag: "1" },
          blockTag ?? "latest",
        ]);
        return ok(result);
      } catch (e) {
        return fail(String(e));
      }
    },
  );

  server.registerTool(
    "aries_contract_meta",
    {
      description:
        "Get an Alkanes contract's metadata (name, symbol, decimals, totalSupply) by its alkane id {block, tx}, via the alkanes_meta view. String id form is block:tx. Note: some contracts (incl. frBTC 32:0) do not implement the meta view and will error — for those, read fields via aries_simulate opcodes (or use aries_frbtc_status for frBTC).",
      inputSchema: {
        block: z.number().int().describe("Etching block height"),
        tx: z.number().int().describe("Tx index within that block"),
        blockTag: z.string().optional(),
      },
    },
    async ({ block, tx, blockTag }) => {
      try {
        // The id must be wrapped in `target`; a bare {block,tx} errors with
        // "Missing or invalid 'target' parameter". (verified live)
        return ok(
          await rpc("alkanes_meta", [{ target: { block, tx } }, blockTag ?? "latest"]),
        );
      } catch (e) {
        return fail(String(e));
      }
    },
  );

  server.registerTool(
    "aries_bytecode",
    {
      description:
        "Fetch the raw WASM bytecode (hex) of an Alkanes contract by {block, tx}. For human-readable disassembly, pair with the `alkanes inspect <outpoint> --disasm --meta` CLI.",
      inputSchema: {
        block: z.number().int(),
        tx: z.number().int(),
        blockTag: z.string().optional(),
      },
    },
    async ({ block, tx, blockTag }) => {
      try {
        const r = await rpc<{ bytecode?: string }>("alkanes_getbytecode", [
          { block, tx },
          blockTag ?? "latest",
        ]);
        const len = r?.bytecode ? r.bytecode.length / 2 : 0;
        return ok({ ...r, approxBytes: len });
      } catch (e) {
        return fail(String(e));
      }
    },
  );

  server.registerTool(
    "aries_simulate",
    {
      description:
        "Simulate an Alkanes view call against a contract without broadcasting — the way to read contract state by invoking an opcode. Pass the full simulation request object. The opcode goes in `inputs` (e.g. [103]); `target` names the alkane (no [block,tx] prefix in inputs).",
      inputSchema: {
        request: z
          .record(z.any())
          .describe(
            "alkanes_simulate request object, e.g. { alkaneId:{block,tx}, target:{block,tx}, inputs:[103], pointer:0, refundPointer:0, vout:0, data:'0x' }",
          ),
        blockTag: z.string().optional(),
      },
    },
    async ({ request, blockTag }) => {
      try {
        return ok(await rpc("alkanes_simulate", [request, blockTag ?? "latest"]));
      } catch (e) {
        return fail(String(e));
      }
    },
  );

  server.registerTool(
    "aries_frbtc_status",
    {
      description:
        "Convenience: fetch frBTC (alkane 32:0) name, symbol, decimals, total supply, and current signer in one call. Good for 'is the peg live / who is the signer / how much frBTC exists' questions.",
      inputSchema: {},
    },
    async () => {
      // frBTC's standard `alkanes_meta` view panics, so read each field via an
      // opcode view: 99 = name, 100 = symbol, 102 = decimals, 105 = total
      // supply, 103 = get-signer. (verified live)
      const safe = (p: Promise<SimResult>) =>
        p.catch((e): SimResult => ({ execution: { data: "0x", error: String(e) } }));
      try {
        const [nameR, symbolR, decimalsR, supplyR, signerR] = await Promise.all([
          safe(simulateOpcode(FRBTC, 99)),
          safe(simulateOpcode(FRBTC, 100)),
          safe(simulateOpcode(FRBTC, 102)),
          safe(simulateOpcode(FRBTC, 105)),
          safe(simulateOpcode(FRBTC, 103)),
        ]);
        return ok({
          contract: "32:0",
          name: hexToUtf8(nameR.execution?.data),
          symbol: hexToUtf8(symbolR.execution?.data),
          decimals: Number(hexToU128(decimalsR.execution?.data)),
          totalSupply: hexToU128(supplyR.execution?.data), // base units (u128)
          signer: signerR.execution?.data ?? null, // 32-byte x-only pubkey (hex)
          signerError: signerR.execution?.error ?? null,
        });
      } catch (e) {
        return fail(String(e));
      }
    },
  );

  server.registerTool(
    "aries_oracle_read",
    {
      description:
        "Read a value from a deployed Alkanes oracle contract via a staticcall-safe view (alkanes_simulate). Give the oracle's alkane id {block,tx}, the read opcode, and any inputs (u128 each). `decode` shapes execution.data: raw hex (default), u128/u64/u32 (little-endian int as a string), utf8, bool (first byte), or price (16B price ‖ 8B price_block ‖ 8B updated_block). See corpus reference/oracles.md and corpus/oracles/ for each oracle's read opcodes.",
      inputSchema: {
        block: z.number().int(),
        tx: z.number().int(),
        opcode: z
          .number()
          .int()
          .describe("Read opcode, e.g. price feed 10 = GetPrice, block-header 10 = current_height"),
        inputs: z
          .array(z.number().int())
          .optional()
          .describe("Opcode args (u128 each), e.g. [symbolId]"),
        decode: z.enum(["raw", "u128", "u64", "u32", "utf8", "bool", "price"]).optional(),
        blockTag: z.string().optional(),
      },
    },
    async ({ block, tx, opcode, inputs, decode, blockTag }) => {
      try {
        const r = await simulateOpcode({ block, tx }, opcode, inputs ?? [], blockTag ?? "latest");
        if (r.execution?.error) {
          return ok({ oracle: `${block}:${tx}`, opcode, error: r.execution.error });
        }
        return ok({
          oracle: `${block}:${tx}`,
          opcode,
          decoded: decodeData(r.execution?.data, (decode ?? "raw") as Decode),
          data: r.execution?.data ?? "0x",
          status: r.status,
        });
      } catch (e) {
        return fail(String(e));
      }
    },
  );

  server.registerTool(
    "aries_oracle_price",
    {
      description:
        "Read the latest price from a Chainlink-style Alkanes price-feed oracle (opcode 10 = GetPrice). Give the oracle alkane id {block,tx} and the symbolId. Returns priceE8 (raw 1e8-scaled u128), price (number), priceBlock, updatedBlock, and ageBlocks (vs current height). Needs a deployed price-feed instance — the feed is a template (see reference/oracles.md), so pass the id you want to read.",
      inputSchema: {
        block: z.number().int(),
        tx: z.number().int(),
        symbolId: z.number().int().describe("Symbol id registered in the feed (u32)"),
        blockTag: z.string().optional(),
      },
    },
    async ({ block, tx, symbolId, blockTag }) => {
      try {
        const r = await simulateOpcode({ block, tx }, 10, [symbolId], blockTag ?? "latest");
        if (r.execution?.error) {
          return fail(`oracle ${block}:${tx} GetPrice(${symbolId}): ${r.execution.error}`);
        }
        const p = decodeData(r.execution?.data, "price") as {
          priceE8: string;
          price: number;
          priceBlock: number;
          updatedBlock: number;
        };
        let ageBlocks: number | null = null;
        try {
          const height = Number(await rpc<string>("metashrew_height", []));
          if (Number.isFinite(height) && p.updatedBlock) ageBlocks = height - p.updatedBlock;
        } catch {
          /* height is best-effort */
        }
        return ok({ oracle: `${block}:${tx}`, symbolId, ...p, ageBlocks });
      } catch (e) {
        return fail(String(e));
      }
    },
  );

  server.registerTool(
    "aries_token",
    {
      description:
        "Read any Alkanes token's metadata (name, symbol, decimals, totalSupply) by its alkane id {block, tx} via opcode views — works when alkanes_meta does not. Detects supply at opcode 105 (frBTC-style) or 101 (orbital/NFT-style) and flags supply-1 tokens as likely Orbitals.",
      inputSchema: {
        block: z.number().int(),
        tx: z.number().int(),
        blockTag: z.string().optional(),
      },
    },
    async ({ block, tx, blockTag }) => {
      try {
        return ok(await readToken({ block, tx }, blockTag ?? "latest"));
      } catch (e) {
        return fail(String(e));
      }
    },
  );

  server.registerTool(
    "aries_diesel_status",
    {
      description:
        "Convenience: read DIESEL — the Alkanes genesis token at 2:0 (the base token most contracts pair against) — name, symbol, decimals, and totalSupply in one call.",
      inputSchema: {},
    },
    async () => {
      try {
        return ok({ token: "DIESEL", ...(await readToken({ block: 2, tx: 0 })) });
      } catch (e) {
        return fail(String(e));
      }
    },
  );

  server.registerTool(
    "aries_pools",
    {
      description:
        "List Alkanes AMM liquidity pools with details (reserves, TVL, 24h volume, trending) for a factory, via the Subfrost REST API (get-all-pools-details). `factory` defaults to 4:65522 (the documented AMM factory); if that returns 0 pools, pass your AMM factory's block:tx.",
      inputSchema: {
        factory: z
          .string()
          .optional()
          .describe('AMM factory alkane id "block:tx" (default "4:65522")'),
      },
    },
    async ({ factory }) => {
      try {
        const [block, tx] = (factory ?? "4:65522").split(":");
        return ok(await restPost("/get-all-pools-details", { factoryId: { block, tx } }));
      } catch (e) {
        return fail(String(e));
      }
    },
  );

  server.registerTool(
    "aries_pool_info",
    {
      description:
        "Get details (reserves, token pair, price) for one Alkanes AMM pool via the Subfrost REST API (get-pool-details). Give the pool's alkane id as block:tx; `factory` defaults to 4:65522.",
      inputSchema: {
        pool: z.string().describe('Pool alkane id "block:tx"'),
        factory: z
          .string()
          .optional()
          .describe('AMM factory alkane id "block:tx" (default "4:65522")'),
      },
    },
    async ({ pool, factory }) => {
      try {
        const [fb, ft] = (factory ?? "4:65522").split(":");
        const [pb, pt] = pool.split(":");
        return ok(
          await restPost("/get-pool-details", {
            factoryId: { block: fb, tx: ft },
            poolId: { block: pb, tx: pt },
          }),
        );
      } catch (e) {
        return fail(String(e));
      }
    },
  );

  server.registerTool(
    "aries_rpc",
    {
      description:
        "Escape hatch: call any read-only Subfrost gateway method directly (esplora_*, ord_*, metashrew_*, alkanes_*, brc20_*, and read-only btc_get*/btc_decode*). Write/broadcast methods are blocked. Use the docs tools to find method names and params.",
      inputSchema: {
        method: z.string().describe("Full JSON-RPC method, e.g. esplora_address::txs"),
        params: z.array(z.any()).optional(),
      },
    },
    async ({ method, params }) => {
      try {
        assertAllowed(method);
        return ok(await rpc(method, params ?? []));
      } catch (e) {
        return fail(String(e));
      }
    },
  );

  if (!hasApiKey()) {
    // Surfaced once at registration via stderr in index.ts; tools still register
    // so the docs/dev layer works offline.
  }
}
