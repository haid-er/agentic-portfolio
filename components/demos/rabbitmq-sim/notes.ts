import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Four simulated sensor streams (phone and watch accelerometer, gyroscope and heart rate) publish to one exchange. Switch it between direct, topic and fanout, or edit the binding keys, and the router applies real AMQP matching rules (* for one word, # for zero or more). Queues push messages to consumers up to their prefetch (basic.qos); a consumer processes them one at a time and acks or nacks each one. A first failure is requeued with redelivered=true, a second goes to the dead-letter exchange, and a full queue drops its oldest message to the dead-letter queue as well. Kill a consumer to watch its unacked messages come back, or switch it to auto-ack to see why that loses data.',
  limits: [
    'A deterministic model of RabbitMQ semantics running in your browser, not a real broker: there is no network, persistence, clustering or publisher confirms.',
    'Timings are simulated and scaled for watching, not measured.',
    'The Java snippet is illustrative client code that matches the current settings; it is not executed.',
  ],
  stack: ['TypeScript broker model (AMQP 0-9-1 semantics)', 'SVG', 'React 19', 'requestAnimationFrame'],
}
