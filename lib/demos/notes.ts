/** All demo notes (server safe). Generated shape: one import per demo folder. */
import type { DemoSlug } from './slugs'
import type { DemoNotes } from './types'
import { notes as orgChartExtractor } from '@/components/demos/org-chart-extractor/notes'
import { notes as esgGapChecker } from '@/components/demos/esg-gap-checker/notes'
import { notes as ownershipExtractor } from '@/components/demos/ownership-extractor/notes'
import { notes as askMalik } from '@/components/demos/ask-malik/notes'
import { notes as agentOrchestra } from '@/components/demos/agent-orchestra/notes'
import { notes as mcpToolLab } from '@/components/demos/mcp-tool-lab/notes'
import { notes as vectorSpaceExplorer } from '@/components/demos/vector-space-explorer/notes'
import { notes as legalRagAssistant } from '@/components/demos/legal-rag-assistant/notes'
import { notes as promptCostLab } from '@/components/demos/prompt-cost-lab/notes'
import { notes as harLive } from '@/components/demos/har-live/notes'
import { notes as sensorPipeline } from '@/components/demos/sensor-pipeline/notes'
import { notes as neuralPlayground } from '@/components/demos/neural-playground/notes'
import { notes as rabbitmqSim } from '@/components/demos/rabbitmq-sim/notes'
import { notes as bullmqJobs } from '@/components/demos/bullmq-jobs/notes'
import { notes as liveTelemetry } from '@/components/demos/live-telemetry/notes'
import { notes as layeredApiLab } from '@/components/demos/layered-api-lab/notes'
import { notes as rbacAuditLab } from '@/components/demos/rbac-audit-lab/notes'
import { notes as rateLimiter } from '@/components/demos/rate-limiter/notes'
import { notes as ghgCalculator } from '@/components/demos/ghg-calculator/notes'
import { notes as gridCarbonLive } from '@/components/demos/grid-carbon-live/notes'
import { notes as solarPvEstimator } from '@/components/demos/solar-pv-estimator/notes'
import { notes as stripeConnectFlow } from '@/components/demos/stripe-connect-flow/notes'
import { notes as webPerfLab } from '@/components/demos/web-perf-lab/notes'
import { notes as dispatchBoard } from '@/components/demos/dispatch-board/notes'
import { notes as liveChat } from '@/components/demos/live-chat/notes'
import { notes as kanbanBoard } from '@/components/demos/kanban-board/notes'
import { notes as dataGrid } from '@/components/demos/data-grid/notes'
import { notes as algoVisualizer } from '@/components/demos/algo-visualizer/notes'
import { notes as codeJudge } from '@/components/demos/code-judge/notes'
import { notes as sqlPlayground } from '@/components/demos/sql-playground/notes'
import { notes as designStudio } from '@/components/demos/design-studio/notes'
import { notes as themeLab } from '@/components/demos/theme-lab/notes'
import { notes as cricketSim } from '@/components/demos/cricket-sim/notes'
import { notes as automationRecorder } from '@/components/demos/automation-recorder/notes'
import { notes as ciPipeline } from '@/components/demos/ci-pipeline/notes'
import { notes as systemDesignCanvas } from '@/components/demos/system-design-canvas/notes'

export const DEMO_NOTES: Record<DemoSlug, DemoNotes> = {
  'org-chart-extractor': orgChartExtractor,
  'esg-gap-checker': esgGapChecker,
  'ownership-extractor': ownershipExtractor,
  'ask-malik': askMalik,
  'agent-orchestra': agentOrchestra,
  'mcp-tool-lab': mcpToolLab,
  'vector-space-explorer': vectorSpaceExplorer,
  'legal-rag-assistant': legalRagAssistant,
  'prompt-cost-lab': promptCostLab,
  'har-live': harLive,
  'sensor-pipeline': sensorPipeline,
  'neural-playground': neuralPlayground,
  'rabbitmq-sim': rabbitmqSim,
  'bullmq-jobs': bullmqJobs,
  'live-telemetry': liveTelemetry,
  'layered-api-lab': layeredApiLab,
  'rbac-audit-lab': rbacAuditLab,
  'rate-limiter': rateLimiter,
  'ghg-calculator': ghgCalculator,
  'grid-carbon-live': gridCarbonLive,
  'solar-pv-estimator': solarPvEstimator,
  'stripe-connect-flow': stripeConnectFlow,
  'web-perf-lab': webPerfLab,
  'dispatch-board': dispatchBoard,
  'live-chat': liveChat,
  'kanban-board': kanbanBoard,
  'data-grid': dataGrid,
  'algo-visualizer': algoVisualizer,
  'code-judge': codeJudge,
  'sql-playground': sqlPlayground,
  'design-studio': designStudio,
  'theme-lab': themeLab,
  'cricket-sim': cricketSim,
  'automation-recorder': automationRecorder,
  'ci-pipeline': ciPipeline,
  'system-design-canvas': systemDesignCanvas,
}
