import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Every point you place becomes a training example. In classification mode a small multilayer perceptron maps (x₁, x₂) to the probability of class B, trained with binary cross-entropy; in regression mode it maps x to y with mean squared error. Backpropagation and the Adam optimiser are written out by hand in TypeScript and run full-batch for a few milliseconds per frame, so you can watch the decision field, the 50/50 boundary (marching squares), the loss curve and the weights change as it learns. Hold out 20% of the points to see over-fitting appear, then add an L2 penalty to rein it in.',
  limits: [
    'Tiny networks only (up to two hidden layers of 16) and at most 400 points, to keep training real-time on a phone.',
    'Full-batch training, no mini-batches or early stopping. It is a teaching tool, not a library.',
    'Training pauses after every 20,000 epochs and whenever the plane is off-screen or the tab is hidden.',
  ],
  stack: ['TypeScript (hand-written backprop + Adam)', 'Canvas 2D', 'SVG', 'React 19'],
}
