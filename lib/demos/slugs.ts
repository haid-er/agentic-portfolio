/** Every demo slug. Order = default playground order. Kept dependency-free so the content schema can import it. */
export const DEMO_SLUGS = [
  'org-chart-extractor', 'esg-gap-checker', 'ownership-extractor',
  'ask-malik', 'agent-orchestra', 'mcp-tool-lab',
  'vector-space-explorer', 'legal-rag-assistant', 'prompt-cost-lab',
  'har-live', 'sensor-pipeline', 'neural-playground',
  'rabbitmq-sim', 'bullmq-jobs', 'live-telemetry',
  'layered-api-lab', 'rbac-audit-lab', 'rate-limiter',
  'ghg-calculator', 'grid-carbon-live', 'solar-pv-estimator',
  'stripe-connect-flow', 'web-perf-lab', 'dispatch-board',
  'live-chat', 'kanban-board', 'data-grid',
  'algo-visualizer', 'code-judge', 'sql-playground',
  'design-studio', 'theme-lab', 'cricket-sim',
  'automation-recorder', 'ci-pipeline', 'system-design-canvas',
] as const

export type DemoSlug = (typeof DEMO_SLUGS)[number]

export function isDemoSlug(v: string): v is DemoSlug {
  return (DEMO_SLUGS as readonly string[]).includes(v)
}
