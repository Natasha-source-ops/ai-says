// AI Says – Task Hub
// Small web server between the MCP server and your phone.
//   Phone  <-- Server-Sent Events (live tasks) --  Hub  <-- REST --  MCP server
//   Phone  --- POST /api/tasks/:id/complete --->  Hub
// No framework, only Node built-ins.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? 3030);
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

type TaskType = "move" | "dance" | "explain" | "other";
type Status = "pending" | "done" | "skipped";

interface Task {
  id: string;
  text: string;
  type: TaskType;
  song?: string;
  status: Status;
  answer?: string;
  createdAt: string;
  finishedAt?: string;
}

const tasks: Task[] = [];
const waiters = new Map<string, Array<(t: Task) => void>>();
const phones = new Set<http.ServerResponse>();

// ---------- helpers ----------

function send(res: http.ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(body));
}

async function readJson(req: http.IncomingMessage): Promise<any> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new Error("Body zu groß");
  }
  return raw ? JSON.parse(raw) : {};
}

function broadcast(event: string, data: unknown) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of phones) res.write(msg);
}

function finish(task: Task) {
  for (const resolve of waiters.get(task.id) ?? []) resolve(task);
  waiters.delete(task.id);
}

function waitFor(task: Task, seconds: number): Promise<Task> {
  if (task.status !== "pending" || seconds <= 0) return Promise.resolve(task);
  return new Promise((resolve) => {
    const list = waiters.get(task.id) ?? [];
    const timer = setTimeout(() => resolve(task), seconds * 1000);
    list.push((t) => {
      clearTimeout(timer);
      resolve(t);
    });
    waiters.set(task.id, list);
  });
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

// ---------- server ----------

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const parts = url.pathname.split("/").filter(Boolean); // e.g. ["api","tasks","<id>","complete"]

    // Live stream for the phone
    if (req.method === "GET" && url.pathname === "/events") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      res.write(`event: hello\ndata: ${JSON.stringify({ tasks: tasks.slice(-20) })}\n\n`);
      phones.add(res);
      const ping = setInterval(() => res.write(": ping\n\n"), 20_000);
      req.on("close", () => {
        clearInterval(ping);
        phones.delete(res);
      });
      return;
    }

    // REST API
    if (parts[0] === "api" && parts[1] === "tasks") {
      if (req.method === "GET" && parts.length === 2) return send(res, 200, { tasks, phonesConnected: phones.size });

      if (req.method === "POST" && parts.length === 2) {
        const body = await readJson(req);
        const text = String(body.text ?? "").trim();
        if (!text) return send(res, 400, { error: "text fehlt" });
        const type: TaskType = ["move", "dance", "explain", "other"].includes(body.type) ? body.type : "other";
        const task: Task = {
          id: randomUUID().slice(0, 8),
          text: text.slice(0, 500),
          type,
          song: body.song ? String(body.song).slice(0, 200) : undefined,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        tasks.push(task);
        broadcast("task", task);
        return send(res, 201, { task, phonesConnected: phones.size });
      }

      const task = tasks.find((t) => t.id === parts[2]);
      if (!task) return send(res, 404, { error: "Aufgabe nicht gefunden" });

      if (req.method === "GET" && parts.length === 3) {
        const wait = Math.min(Number(url.searchParams.get("wait") ?? 0), 55);
        return send(res, 200, { task: await waitFor(task, wait) });
      }

      if (req.method === "POST" && parts[3] === "complete") {
        if (task.status !== "pending") return send(res, 409, { error: "Aufgabe ist schon abgeschlossen" });
        const body = await readJson(req);
        task.status = body.status === "skipped" ? "skipped" : "done";
        task.answer = body.answer ? String(body.answer).slice(0, 1000) : undefined;
        task.finishedAt = new Date().toISOString();
        broadcast("update", task);
        finish(task);
        return send(res, 200, { task });
      }
    }

    // Static files (phone page)
    if (req.method === "GET") {
      const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      const full = path.join(PUBLIC_DIR, file);
      if (!full.startsWith(PUBLIC_DIR)) return send(res, 403, { error: "verboten" });
      try {
        const data = await readFile(full);
        res.writeHead(200, { "Content-Type": MIME[path.extname(full)] ?? "application/octet-stream" });
        return res.end(data);
      } catch {
        /* fall through to 404 */
      }
    }

    send(res, 404, { error: "nicht gefunden" });
  } catch (err) {
    send(res, 400, { error: (err as Error).message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\nAI Says Hub läuft auf Port ${PORT}\n`);
  console.log("Aufgaben-Seite im Browser öffnen:   http://localhost:" + PORT);
  console.log("");
});
