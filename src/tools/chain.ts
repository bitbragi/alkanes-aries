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

// frBTC contract is the alkane at block 32, tx 0. Opcode 103 = get-signer.
const FRBTC = { block: 32, tx: 0 };

export function registerChainTools(server: McpServer): void {
  server.registerTool(
    "aries_tokens_by_address",
    {
      description:
        "List all Alkanes tokens held by a Bitcoin address (wraps alkanes_protorunesbyaddress, protocolTag is always 1). Returns outpoints and the rune balances at each.",
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
        "Get an Alkanes contract's metadata (name, symbol, decimals, totalSupply) by its alkane id {block, tx}. String id form is block:tx, e.g. 32:0 = frBTC.",
      inputSchema: {
        block: z.number().int().describe("Etching block height"),
        tx: z.number().int().describe("Tx index within that block"),
        blockTag: z.string().optional(),
      },
    },
    async ({ block, tx, blockTag }) => {
      try {
        return ok(await rpc("alkanes_meta", [{ block, tx }, blockTag ?? "latest"]));
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
        "Simulate an Alkanes view call against a contract without broadcasting — the way to read contract state by invoking an opcode. Pass the full simulation request object (alkaneId, target, inputs, pointer, refundPointer, vout, data).",
      inputSchema: {
        request: z
          .record(z.any())
          .describe(
            "alkanes_simulate request object, e.g. { alkaneId:{block,tx}, target:{block,tx}, inputs:[], pointer:0, refundPointer:0, vout:0, data:'0x…' }",
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
        "Convenience: fetch frBTC (alkane 32:0) metadata and current signer in one call. Good for 'is the peg live / who is the signer' questions.",
      inputSchema: {},
    },
    async () => {
      try {
        const meta = await rpc("alkanes_meta", [FRBTC, "latest"]).catch(
          (e) => ({ error: String(e) }),
        );
        // Opcode 103 = get-signer, invoked as a view via simulate.
        const signer = await rpc("alkanes_simulate", [
          {
            alkaneId: FRBTC,
            target: FRBTC,
            inputs: [],
            pointer: 0,
            refundPointer: 0,
            vout: 0,
            data: "0x67", // 103
          },
          "latest",
        ]).catch((e) => ({ error: String(e) }));
        return ok({ contract: "32:0", meta, signerProbe: signer });
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
