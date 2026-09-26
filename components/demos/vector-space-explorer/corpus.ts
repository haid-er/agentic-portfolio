/**
 * Sample corpus for the vector space explorer: four deliberately separate topics,
 * written so that meaning (not shared words) is what groups them. Generic demo text.
 */
export type Topic = 'climate' | 'motion' | 'systems' | 'kitchen' | 'custom'
export type Shape = 'circle' | 'square' | 'triangle' | 'diamond' | 'star'

export interface TopicStyle {
  id: Topic
  label: string
  /** CSS colour token for the mark. */
  ink: string
  /** Shape so colour is never the only signal. */
  shape: Shape
}

export const TOPICS: readonly TopicStyle[] = [
  { id: 'climate', label: 'Climate', ink: 'var(--data-1)', shape: 'circle' },
  { id: 'motion', label: 'Motion sensing', ink: 'var(--data-2)', shape: 'triangle' },
  { id: 'systems', label: 'Backend systems', ink: 'var(--data-3)', shape: 'square' },
  { id: 'kitchen', label: 'Kitchen', ink: 'var(--data-4)', shape: 'diamond' },
  { id: 'custom', label: 'Yours', ink: 'var(--accent)', shape: 'star' },
]

export const topicStyle = (t: Topic): TopicStyle => TOPICS.find((x) => x.id === t) ?? TOPICS[0]

export interface Doc {
  id: string
  text: string
  topic: Topic
}

export const DOCS: readonly Doc[] = [
  { id: 'cl-1', topic: 'climate', text: 'Heat pumps cut the carbon footprint of old office blocks.' },
  { id: 'cl-2', topic: 'climate', text: 'Solar panels on the roof charge the building battery at noon.' },
  { id: 'cl-3', topic: 'climate', text: 'Scope 2 emissions come from the electricity a company buys.' },
  { id: 'cl-4', topic: 'climate', text: 'The power grid is cleanest on windy nights.' },
  { id: 'cl-5', topic: 'climate', text: 'Better insulation lowers winter gas bills.' },
  { id: 'cl-6', topic: 'climate', text: 'New reporting rules ask firms to disclose climate risks.' },

  { id: 'mo-1', topic: 'motion', text: 'The wristband accelerometer samples fifty times a second.' },
  { id: 'mo-2', topic: 'motion', text: 'Climbing stairs leaves a rhythmic vertical signal.' },
  { id: 'mo-3', topic: 'motion', text: 'Gyroscope readings reveal when someone turns around.' },
  { id: 'mo-4', topic: 'motion', text: 'A fall shows up as a sharp spike followed by stillness.' },
  { id: 'mo-5', topic: 'motion', text: 'Sliding windows cut the sensor stream into five-second clips.' },
  { id: 'mo-6', topic: 'motion', text: 'The classifier tells walking apart from jogging.' },

  { id: 'sy-1', topic: 'systems', text: 'The queue holds jobs until a worker is free.' },
  { id: 'sy-2', topic: 'systems', text: 'Retries with backoff stop a flaky service from being hammered.' },
  { id: 'sy-3', topic: 'systems', text: 'A message broker routes each event to every subscriber.' },
  { id: 'sy-4', topic: 'systems', text: 'Rate limiting protects the API from bursts of traffic.' },
  { id: 'sy-5', topic: 'systems', text: 'Idempotent handlers make duplicate deliveries harmless.' },
  { id: 'sy-6', topic: 'systems', text: 'A cache answers repeat requests without touching the database.' },

  { id: 'ki-1', topic: 'kitchen', text: 'Knead the dough until it springs back when pressed.' },
  { id: 'ki-2', topic: 'kitchen', text: 'Toast the cumin seeds before grinding them.' },
  { id: 'ki-3', topic: 'kitchen', text: 'A pinch of salt makes caramel taste richer.' },
  { id: 'ki-4', topic: 'kitchen', text: 'Let the stew simmer slowly for two hours.' },
  { id: 'ki-5', topic: 'kitchen', text: 'Sharp knives are safer than dull ones.' },
  { id: 'ki-6', topic: 'kitchen', text: 'Rest the roast before carving so the juices settle.' },
]

/** Queries that show where meaning beats word overlap. */
export const SAMPLE_QUERIES: readonly string[] = [
  'How can a building pollute less?',
  'Recognising what someone is doing from a smartwatch',
  'Coping with a sudden flood of requests',
  'How do I bake bread?',
  'A sudden drop',
]

/**
 * Chunking lab document: an original tenant guide, so the text can be cut many ways.
 * Each question lists the phrase that must survive inside one chunk for a clean answer.
 */
export const CHUNK_DOC = `Your building is heated by an air-source heat pump on the roof. It pulls warmth out of the outside air, even on frosty mornings, and delivers water to the radiators at up to 55 degrees. Because it runs on electricity, its carbon footprint falls every year as the grid gets cleaner.

The pump works best when it runs low and steady. Please leave radiator valves open in rooms you use, and avoid turning the thermostat up and down during the day. A steady 20 degrees costs less than short blasts of heat.

Hot water is stored in a cylinder in the plant room and heated overnight, when electricity is cheapest. A timer lifts the cylinder to 60 degrees once a week to keep the water safe.

If the heating fails, first check the thermostat display for a fault code. Then call the building manager on the number in the lobby, day or night. Do not open the plant room yourself: the pump contains refrigerant under pressure.`

export interface ChunkQuestion {
  q: string
  /** Lower-case phrase the ideal chunk contains in full. */
  answer: string
}

export const CHUNK_QUESTIONS: readonly ChunkQuestion[] = [
  { q: 'How hot is the water sent to the radiators?', answer: 'delivers water to the radiators at up to 55 degrees' },
  { q: 'Who do I contact when the heating stops working?', answer: 'call the building manager on the number in the lobby' },
  { q: 'When is the hot water heated?', answer: 'heated overnight, when electricity is cheapest' },
  { q: 'Is it cheaper to keep the heat steady?', answer: 'a steady 20 degrees costs less than short blasts of heat' },
]
