import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { rpc, assertAllowed, hasApiKey } from "../rpc.js";

const ok = (data: unknown) => ({
  content: [
    { type: "text" as const, text: JSON.stringify(data, null, 2) },
  ],
});
const fail = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
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
 *  The opcode goes in the cellpack `inputs` (NOT `data`); `target` names the
 *  alkane, so no [block,tx] prefix is needed. */
function simulateOpcode(
  id: { block: number; tx: number },
  opcode: number,
  blockTag = "latest",
): Promise<SimResult> {
  return rpc<SimResult>("alkanes_simulate", [
    {
      alkaneId: id,
      target: id,
      inputs: [opcode],
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

/** Decode a "0x…" little-endian u128 hex string into a decimal string. */
function hexToU128(hex?: string): string {
  if (!hex || hex === "0x") return "0";
  const b = hex.replace(/^0x/, "");
  let n = 0n;
  for (let i = 0; i < b.length; i += 2) {
    n |= BigInt(parseInt(b.slice(i, i + 2), 16)) << BigInt(4 * i);
  }
  return n.toString();
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
