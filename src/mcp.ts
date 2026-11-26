#!/usr/bin/env node


// HUB_URL defaults to http://localhost:3030

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const HUB = process.env.HUB_URL ?? "http://localhost:3030";

//shown live at localhost:3030/demo.
let traceCounter = 0;
function trace(ev: Record<string, unknown>): Promise<void> {
  const ts = Date.now() + (++traceCounter % 1000) / 1000; // keeps the order of events in the same millisecond
  return fetch(HUB + "/api/trace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...ev, ts }),
  }).then(
    () => undefined,
    () => undefined,
  );
}

interface Task {
  id: string;
  text: string;
  type: string;
  song?: string;
  status: "pending" | "done" | "skipped";
  answer?: string;
}

async function hub(pathname: string, init?: RequestInit): Promise<any> {
  let res: Response;
  try {
    res = await fetch(HUB + pathname, { ...init, headers: { "Content-Type": "application/json" } });
  } catch {
    throw new Error(`Hub nicht erreichbar unter ${HUB}. Läuft "npm run hub"?`);
  }
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

function describe(t: Task): string {
  if (t.status === "pending") {
    return `Aufgabe ${t.id} läuft noch. Der Mensch ist noch nicht fertig. Später mit get_task_result(id: "${t.id}") nachfragen.`;
  }
  if (t.status === "skipped") return `Aufgabe ${t.id} wurde übersprungen.${t.answer ? ` Begründung: ${t.answer}` : ""}`;
  return `Aufgabe ${t.id} erledigt.${t.answer ? ` Antwort des Menschen: ${t.answer}` : " (keine Antwort eingegeben)"}`;
}

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const fail = (s: string) => ({ content: [{ type: "text" as const, text: s }], isError: true });

const server = new McpServer({ name: "ai-says", version: "0.1.0" });

// ---------- Tools ----------

server.registerTool(
  "send_task",
  {
    title: "Aufgabe ans Handy senden",
    description:
      "Sends a real-world task to the human's phone and waits until they tap Done or Skip. " +
      "Use short, safe, concrete instructions (one action per task). For dance tasks, add a song. " +
      "For 'explain' tasks, ask a question the human answers in the text field.",
    inputSchema: {
      text: z.string().min(2).max(300).describe("The instruction shown on the phone, e.g. 'Dreh dich einmal im Kreis'"),
      type: z.enum(["move", "dance", "explain", "other"]).default("other").describe("Kind of task, changes the icon on the phone"),
      song: z.string().max(150).optional().describe("Song for dance tasks, e.g. 'Daft Punk – One More Time'. Phone shows an 'Open in Spotify' button."),
      waitSeconds: z.number().int().min(0).max(55).default(45).describe("How long to wait for the human before returning"),
    },
  },
  async ({ text: taskText, type, song, waitSeconds }) => {
    await trace({ kind: "step", step: "validate", args: { text: taskText, type, song, waitSeconds } });
    // Safety rule lives in the server, not in the prompt:
    if (/\b(stra(ss|ß)e überqueren|auto fahren|klettern|messer|feuer)\b/i.test(taskText)) {
      await trace({ kind: "step", step: "safety-blocked", text: taskText });
      return fail("Abgelehnt: Diese Aufgabe ist nicht sicher. Bitte eine harmlose Aufgabe für drinnen senden.");
    }
    await trace({ kind: "step", step: "safety-ok", text: taskText });
    try {
      await trace({ kind: "step", step: "to-hub", body: { text: taskText, type, song } });
      const { task, phonesConnected } = await hub("/api/tasks",
        { method: "POST", body: JSON.stringify({ text: taskText, type, song }) });
      if (phonesConnected === 0) {
        return text(`Aufgabe ${task.id} gespeichert, aber gerade ist kein Handy verbunden. Der Mensch sieht sie, sobald er die Seite öffnet.`);
      }
      await trace({ kind: "step", step: "wait", id: task.id, waitSeconds });
      const { task: result } = await hub(`/api/tasks/${task.id}?wait=${waitSeconds}`);
      await trace({ kind: "step", step: "result", task: result });
      return text(describe(result));
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

server.registerTool(
  "get_task_result",
  {
    title: "Ergebnis abfragen",
    description: "Checks whether the human finished a task. Optionally waits up to 55 seconds.",
    inputSchema: {
      id: z.string().describe("Task id returned by send_task"),
      waitSeconds: z.number().int().min(0).max(55).default(30),
    },
  },
  async ({ id, waitSeconds }) => {
    try {
      const { task } = await hub(`/api/tasks/${encodeURIComponent(id)}?wait=${waitSeconds}`);
      return text(describe(task));
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

server.registerTool(
  "list_tasks",
  {
    title: "Alle Aufgaben",
    description: "Lists all tasks of this session with status and answers.",
    inputSchema: {},
  },
  async () => {
    try {
      const { tasks, phonesConnected } = await hub("/api/tasks");
      const lines = (tasks as Task[]).map((t) => `${t.id} | ${t.type} | ${t.status} | ${t.text}${t.answer ? ` → ${t.answer}` : ""}`);
      return text(`Handys verbunden: ${phonesConnected}\n${lines.join("\n") || "Noch keine Aufgaben."}`);
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

// ---------- Resource ----------

server.registerResource(
  "history",
  "tasks://history",
  { title: "Aufgabenverlauf", description: "All tasks and answers as JSON", mimeType: "application/json" },
  async (uri) => {
    const { tasks } = await hub("/api/tasks");
    return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(tasks, null, 2) }] };
  },
);

// ---------- Prompt ----------

server.registerPrompt(
  "start_challenge",
  {
    title: "Challenge starten",
    description: "Starts a little game: the AI sends several tasks in a row",
    argsSchema: {
      kind: z.enum(["dance", "move", "explain", "mixed"]).describe("Type of challenge"),
      rounds: z.string().default("3").describe("Number of tasks"),
    },
  },
  ({ kind, rounds }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text:
            `Starte eine "${kind}"-Challenge mit ${rounds} Aufgaben. Sende jede Aufgabe einzeln mit send_task, ` +
            `warte auf das Ergebnis und passe die nächste Aufgabe an die Antwort an. ` +
            `Nur sichere Aufgaben für drinnen. Am Ende eine kurze, lustige Zusammenfassung auf Deutsch.`,
        },
      },
    ],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);

//  JSON-RPC messages between client and server.
const openRequests = new Map<string | number, string>();
const handleIncoming = transport.onmessage;
transport.onmessage = (message: any, extra?: any) => {
  if (message?.method && message.method !== "ping") {
    if (message.id !== undefined) openRequests.set(message.id, message.method);
    trace({ kind: "rpc-in", method: message.method, json: message });
  }
  (handleIncoming as any)?.(message, extra);
};
const sendOutgoing = transport.send.bind(transport);
(transport as any).send = (message: any, options?: any) => {
  if (message && message.id !== undefined && !message.method && openRequests.has(message.id)) {
    const method = openRequests.get(message.id);
    openRequests.delete(message.id);
    trace({ kind: "rpc-out", method, json: message });
  }
  return (sendOutgoing as any)(message, options);
};
console.error(`ai-says MCP server läuft (stdio), Hub: ${HUB}`);
