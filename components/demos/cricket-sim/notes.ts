import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'An homage to a cricket simulation written in pure C, rebuilt for the browser in the same spirit. The match is one plain, serialisable state object (the "structs"), and every ball goes through a single pure update function, like a game loop. Outcomes come from a lookup table of weights indexed by delivery and shot, adjusted by your timing and the opposition level, and drawn with the ANSI C sample rand(), a 32-bit linear congruential generator seeded once by srand(seed). The same seed and the same choices therefore replay the same match. Bat by facing up and playing a shot as the ball reaches the hit zone (early, good, perfect or late), or bowl by picking deliveries while the CPU batter reads the chase. The engine prints console lines as it goes, which is exactly what terminal mode shows.',
  limits: [
    'A game model, not a physics simulation: outcomes are weighted dice, tuned to feel like short-format cricket.',
    'Rules are simplified: five bowlers rotate every over, wides and no-balls cost one run, a no-ball brings a free hit, and there are no byes, leg-byes or DRS.',
    'Players are numbered, not named. The C sketch is illustrative, written for this demo rather than taken from the original repository.',
    'The match in progress is saved in this browser only.',
  ],
  stack: ['TypeScript (C-style engine)', 'ANSI C sample rand() LCG', 'SVG', 'requestAnimationFrame', 'React 19'],
}
