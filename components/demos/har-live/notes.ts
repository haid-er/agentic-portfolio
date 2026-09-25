import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'On a phone, the demo asks for motion access (iOS shows its own prompt) and resamples the accelerometer to a steady 25 Hz; on a desktop it replays a seeded, synthetic 80-second session instead. Every 125 samples close a 5-second window. The window is turned into four orientation-free channels (magnitude, vertical and horizontal body acceleration, and tilt from a 1-second gravity estimate), so it does not matter how the phone sits in a pocket. An instant feature baseline (softmax regression) classifies every window, and you can train a small CNN-LSTM with TensorFlow.js in the tab and compare the two, live.',
  limits: [
    'Both models are trained on synthetic windows generated in your browser, not on a research dataset, so real-world accuracy depends on how you hold the phone.',
    'The CNN-LSTM is a tiny teaching model in the CNN-LSTM family. It is not the published HyMCL-Net and makes no claim about its results.',
    'Six activities only. Accuracy figures shown are measured live on held-out synthetic windows.',
    'Desktop browsers have no motion sensors, so they get the replay. Nothing is sent anywhere.',
  ],
  stack: ['DeviceMotion API', 'Canvas 2D', 'TensorFlow.js (Conv1D + LSTM)', 'TypeScript signal processing', 'React 19'],
}
