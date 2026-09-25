'use client'
/**
 * Client loaders: one next/dynamic import per demo, all ssr:false (demos use browser APIs:
 * canvas, workers, sensors, storage, BroadcastChannel). Each chunk loads only on its page.
 */
import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'
import { Loading } from '@/components/ui/States'
import type { DemoSlug } from './slugs'
import type { DemoProps } from './types'

const loading = () => <Loading label="Loading demo" className="py-10" />

export const DEMO_LOADERS: Record<DemoSlug, ComponentType<DemoProps>> = {
  'org-chart-extractor': dynamic(() => import('@/components/demos/org-chart-extractor'), { ssr: false, loading }),
  'esg-gap-checker': dynamic(() => import('@/components/demos/esg-gap-checker'), { ssr: false, loading }),
  'ownership-extractor': dynamic(() => import('@/components/demos/ownership-extractor'), { ssr: false, loading }),
  'ask-malik': dynamic(() => import('@/components/demos/ask-malik'), { ssr: false, loading }),
  'agent-orchestra': dynamic(() => import('@/components/demos/agent-orchestra'), { ssr: false, loading }),
  'mcp-tool-lab': dynamic(() => import('@/components/demos/mcp-tool-lab'), { ssr: false, loading }),
  'vector-space-explorer': dynamic(() => import('@/components/demos/vector-space-explorer'), { ssr: false, loading }),
  'legal-rag-assistant': dynamic(() => import('@/components/demos/legal-rag-assistant'), { ssr: false, loading }),
  'prompt-cost-lab': dynamic(() => import('@/components/demos/prompt-cost-lab'), { ssr: false, loading }),
  'har-live': dynamic(() => import('@/components/demos/har-live'), { ssr: false, loading }),
  'sensor-pipeline': dynamic(() => import('@/components/demos/sensor-pipeline'), { ssr: false, loading }),
  'neural-playground': dynamic(() => import('@/components/demos/neural-playground'), { ssr: false, loading }),
  'rabbitmq-sim': dynamic(() => import('@/components/demos/rabbitmq-sim'), { ssr: false, loading }),
  'bullmq-jobs': dynamic(() => import('@/components/demos/bullmq-jobs'), { ssr: false, loading }),
  'live-telemetry': dynamic(() => import('@/components/demos/live-telemetry'), { ssr: false, loading }),
  'layered-api-lab': dynamic(() => import('@/components/demos/layered-api-lab'), { ssr: false, loading }),
  'rbac-audit-lab': dynamic(() => import('@/components/demos/rbac-audit-lab'), { ssr: false, loading }),
  'rate-limiter': dynamic(() => import('@/components/demos/rate-limiter'), { ssr: false, loading }),
  'ghg-calculator': dynamic(() => import('@/components/demos/ghg-calculator'), { ssr: false, loading }),
  'grid-carbon-live': dynamic(() => import('@/components/demos/grid-carbon-live'), { ssr: false, loading }),
  'solar-pv-estimator': dynamic(() => import('@/components/demos/solar-pv-estimator'), { ssr: false, loading }),
  'stripe-connect-flow': dynamic(() => import('@/components/demos/stripe-connect-flow'), { ssr: false, loading }),
  'web-perf-lab': dynamic(() => import('@/components/demos/web-perf-lab'), { ssr: false, loading }),
  'dispatch-board': dynamic(() => import('@/components/demos/dispatch-board'), { ssr: false, loading }),
  'live-chat': dynamic(() => import('@/components/demos/live-chat'), { ssr: false, loading }),
  'kanban-board': dynamic(() => import('@/components/demos/kanban-board'), { ssr: false, loading }),
  'data-grid': dynamic(() => import('@/components/demos/data-grid'), { ssr: false, loading }),
  'algo-visualizer': dynamic(() => import('@/components/demos/algo-visualizer'), { ssr: false, loading }),
  'code-judge': dynamic(() => import('@/components/demos/code-judge'), { ssr: false, loading }),
  'sql-playground': dynamic(() => import('@/components/demos/sql-playground'), { ssr: false, loading }),
  'design-studio': dynamic(() => import('@/components/demos/design-studio'), { ssr: false, loading }),
  'theme-lab': dynamic(() => import('@/components/demos/theme-lab'), { ssr: false, loading }),
  'cricket-sim': dynamic(() => import('@/components/demos/cricket-sim'), { ssr: false, loading }),
  'automation-recorder': dynamic(() => import('@/components/demos/automation-recorder'), { ssr: false, loading }),
  'ci-pipeline': dynamic(() => import('@/components/demos/ci-pipeline'), { ssr: false, loading }),
  'system-design-canvas': dynamic(() => import('@/components/demos/system-design-canvas'), { ssr: false, loading }),
}

/** Renders the demo for `slug` (used by /playground/[slug] and previews). */
export function DemoRenderer({ slug }: DemoProps) {
  const Demo = DEMO_LOADERS[slug]
  return <Demo slug={slug} />
}
