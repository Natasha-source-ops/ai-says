# AI Says 🤖📱

Die KI gibt dir Aufgaben in der echten Welt – du machst sie und tippst auf **Erledigt**.
Ein MCP-Server, bei dem **der Mensch das Tool ist**.

```
Claude (Host)  --MCP/stdio-->  mcp.ts  --REST-->  hub.ts  --Live (SSE)-->  Handy-Webseite
                                                     ^------- Erledigt -------'
```

## Starten (3 Schritte)

```bash
npm install
npm run build
npm run hub
```

Der Hub zeigt zwei Adressen an:
- **Auf dem Handy:** `http://192.168.x.x:3030` – im Handy-Browser öffnen (Laptop und Handy im **gleichen WLAN**)
- Tipp: Auf dem iPhone „Zum Home-Bildschirm“ – dann sieht es aus wie eine App.

## Mit Claude verbinden

**Claude Desktop** → Settings → Developer → Edit Config:
```json
{
  "mcpServers": {
    "ai-says": {
      "command": "node",
      "args": ["/ABSOLUTER/PFAD/zu/ai-says/build/mcp.js"]
    }
  }
}
```
**Claude Code:**
```bash
claude mcp add ai-says -- node /ABSOLUTER/PFAD/zu/ai-says/build/mcp.js
```
Der Hub (`npm run hub`) muss dabei laufen.

Dann z. B. sagen:
- „Gib mir eine Tanz-Challenge mit 3 Songs.“
- „Lass mich durch die Wohnung navigieren: links, rechts, bis ich etwas Blaues finde.“
- „Frag mich, was ich gerade sehe, und erklär mir etwas darüber.“
- Oder den Prompt **start_challenge** auswählen.

## Demo-Ansicht: Was passiert bei einem Tool-Aufruf?
Wenn der Hub läuft, im Browser öffnen: **http://localhost:3030/demo**

Links siehst du live jeden Schritt (Claude → MCP-Client → MCP-Server → Hub → Mensch),
den Code, der gerade läuft, und die echte JSON-RPC-Nachricht. Rechts ist die AI-Says-Seite,
auf der der Mensch „Erledigt“ klickt. Daneben Claude öffnen und einen Prompt schreiben.

## MCP-Bausteine

| Baustein | Name | Zweck |
|---|---|---|
| Tool | `send_task` | Aufgabe ans Handy senden und auf Erledigt/Überspringen warten (max. 55 s) |
| Tool | `get_task_result` | Später nachfragen, ob eine Aufgabe erledigt ist |
| Tool | `list_tasks` | Alle Aufgaben mit Antworten |
| Resource | `tasks://history` | Verlauf als JSON |
| Prompt | `start_challenge` | Mini-Spiel: mehrere Aufgaben hintereinander |

Sicherheitsregel im Server: Aufgaben wie „Straße überqueren“, „klettern“, „Messer“ werden abgelehnt.

## Testen ohne Claude
```bash
npm run inspector
```
Oder direkt per curl (Hub muss laufen):
```bash
curl -X POST localhost:3030/api/tasks -H "Content-Type: application/json" \
  -d '{"text":"Dreh dich einmal im Kreis","type":"move"}'
```

## Wissenswert
- Daten liegen nur im Speicher – nach Neustart des Hubs ist der Verlauf weg.
- Jede Person im gleichen WLAN kann die Seite öffnen. Für die Uni-Demo ok, für mehr später einen Code/Login einbauen.
- Lange Aufgaben: `send_task` wartet höchstens 55 s, danach fragt die KI mit `get_task_result` nach.

## Nächste Ausbaustufen
1. **Spotify Web API**: Song wirklich abspielen (braucht Premium + Developer-App + OAuth)
2. **Foto-Antwort**: Bild hochladen, KI beschreibt/bewertet es
3. **Vue.js-Frontend + Quarkus-Backend + PostgreSQL** (Referenzarchitektur des Kurses), WebSocket statt SSE
4. **Online statt WLAN**: Hub deployen, damit es überall funktioniert
