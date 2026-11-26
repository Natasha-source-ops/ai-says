# AI Says 🤖📱


**What if AI could delegate tasks to humans, not just software?**

AI Says is a small, interactive application built with the Model Context Protocol (MCP). It allows AI applications to assign real-world tasks to humans and receive their feedback.

The idea is simple: AI gives you a task, you complete it, and the result goes back to the AI.

## Why AI Says?

Most MCP integrations connect AI applications to databases, APIs, and external software.

AI Says explores a different possibility: integrating humans into AI-driven workflows through the same standardized protocol.

The project demonstrates Human-in-the-Loop, Tool Discovery, Function Calling, and component-based architecture.

## Getting Started

Clone the repository and start the application:

```bash
git clone https://github.com/Natasha-source-ops/ai-says.git
cd ai-says
npm install
npm run build
npm run hub
```

Open the application:

- **Web app:** http://localhost:3030
- **Interactive demo:** http://localhost:3030/demo

You can also access the application from your phone using the local IP address displayed in the terminal. Both devices must be connected to the same network.

## Connect to Claude Code

```bash
claude mcp add ai-says -- node /ABSOLUTE/PATH/ai-says/build/mcp.js
```

Keep the hub running while using Claude.

## Try It

Ask Claude:

- "Send me a test task."
- "Give me a dance challenge."
- "Give me a task to find something blue."
- "Send me the task: cross the street."

The last request demonstrates server-side safety validation.

## How It Works

```text
Claude (Host + MCP Client)
        │ MCP / JSON-RPC 2.0 (stdio)
        ▼
    MCP Server
        │ REST API
        ▼
       Hub
        │ Server-Sent Events (SSE)
        ▼
   Web App / Human
```

The interactive demo visualizes the communication between components, including the actual JSON-RPC messages and relevant code.

## MCP Capabilities

| Type | Name | Description |
|---|---|---|
| Tool | `send_task` | Assign a task and wait for feedback |
| Tool | `get_task_result` | Retrieve a task result |
| Tool | `list_tasks` | List tasks and responses |
| Resource | `tasks://history` | Access task history |
| Prompt | `start_challenge` | Start an interactive challenge |

## Tech Stack

TypeScript · Node.js · MCP · JSON-RPC 2.0 · REST · Server-Sent Events

## Limitations

AI Says is an educational prototype. Data is stored in memory, authentication is not implemented, and safety rules are limited to basic server-side validation.

## About

Built as a practical demonstration of the Model Context Protocol for the **Component-Based Software Development** course at HTW Berlin.

Learn more about [MCP](https://modelcontextprotocol.io).
