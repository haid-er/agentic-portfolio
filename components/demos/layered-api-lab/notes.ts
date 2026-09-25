import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Every request goes to a real route handler at /api/demos/lab/*. The handler is only an HTTP adapter: it passes the request to a small layered app where a router matches the path, a body parser and a Zod validation middleware check params, query and body, a controller maps HTTP to a service call, the service applies business rules (duplicates, limits) and the repository is the only code that touches storage. Layers throw typed errors and a single error handler turns them into status codes; unexpected errors become a generic 500 with a request id while the stack goes only to the log. Each step is timed and each layer writes Winston-style JSON log lines, which come back in a demo-only _debug envelope so you can see them.',
  limits: [
    'Storage is an in-memory Map per browser session on one server instance, so created rows can vanish after a cold start or when another instance answers; Reset data reseeds it.',
    'The repository prints the SQL a Drizzle/Postgres repository would run, but no database is involved.',
    'The trace and logs are returned in the response body for teaching; a real API would ship them to a log backend and a tracer instead.',
    'The sample sites and their emission numbers are made up.',
    'In Auto mode, if the route cannot be reached the same code runs in your browser and the response says so.',
  ],
  stack: ['Next.js route handler (Node runtime)', 'TypeScript', 'Zod 4', 'Winston-style JSON logging', 'Proxy-based tracing', 'React 19'],
}
