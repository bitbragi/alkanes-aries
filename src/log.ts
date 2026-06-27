// In a stdio MCP server, stdout carries the JSON-RPC protocol frames.
// ANY stray write to stdout corrupts the transport and the client drops the
// connection. So every diagnostic must go to stderr. Never console.log here.
export function log(...args: unknown[]): void {
  process.stderr.write(
    `[aries-mcp] ${args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}\n`,
  );
}
