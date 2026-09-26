import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'The page plays all three MCP roles. An in-browser server exposes four tools (calculator, Open-Meteo weather, unit converter and a BM25 search over this site), each defined by a JSON Schema you can edit. The host opens a session (initialize, notifications/initialized, tools/list), offers the schemas to a model through the site AI gateway, and runs every tool call the model makes as a JSON-RPC tools/call. Results go back to the model until it answers, for at most four turns. Tool failures come back as isError results the model can read, and editing a tool sends notifications/tools/list_changed. Every message is in the protocol log. With no model available, a rules router picks the tools instead and says so.',
  limits: [
    'The MCP server runs in your browser (no stdio or HTTP transport); the message shapes follow the 2025-06-18 spec.',
    'Weather calls go from your browser to open-meteo.com; nothing else leaves the page except the model call to the site gateway.',
    'The offline router is regex rules, so it cannot chain tools or read context the way a model can.',
    'Model turns use free, rate-limited providers, and the loop is capped at four turns.',
  ],
  stack: ['React 19', 'TypeScript', 'JSON-RPC 2.0 / MCP message shapes', 'JSON Schema tool definitions', 'Zod argument validation', 'Open-Meteo API', 'AI gateway tool calling (Groq / Gemini)'],
}
