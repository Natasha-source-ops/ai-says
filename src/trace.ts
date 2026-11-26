// Nur für die Demo-Ansicht (localhost:3030/demo):
// meldet jeden Schritt und jede JSON-RPC-Nachricht an den Hub.
// Hat keinen Einfluss auf MCP selbst – läuft der Hub nicht, passiert einfach nichts.

const HUB = "http://localhost:3030";
let counter = 0;

function post(ev: Record<string, unknown>): Promise<void> {
  const ts = Date.now() + (++counter % 1000) / 1000; // Reihenfolge innerhalb derselben Millisekunde
  return fetch(HUB + "/api/trace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...ev, ts }),
  }).then(() => undefined, () => undefined);
}

// Ein Schritt im MCP-Server, z. B. "to-hub" oder "wait"
export function trace(step: string, data: Record<string, unknown> = {}) {
  return post({ kind: "step", step, ...data });
}

// Alle JSON-RPC-Nachrichten zwischen Client und Server mitlesen
export function traceJsonRpc(transport: any) {
  const open = new Map<string | number, string>();

  const receive = transport.onmessage;
  transport.onmessage = (msg: any, extra?: any) => {
    if (msg?.method && msg.method !== "ping") {
      if (msg.id !== undefined) open.set(msg.id, msg.method);
      post({ kind: "rpc-in", method: msg.method, json: msg });
    }
    receive?.(msg, extra);
  };

  const send = transport.send.bind(transport);
  transport.send = (msg: any, options?: any) => {
    if (msg?.id !== undefined && !msg.method && open.has(msg.id)) {
      post({ kind: "rpc-out", method: open.get(msg.id), json: msg });
      open.delete(msg.id);
    }
    return send(msg, options);
  };
}
