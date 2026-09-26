import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Each vault is a separate board sealed with its own passphrase, so one person cannot read another vault in the same browser. The passphrase is stretched with PBKDF2 into an AES-GCM key that stays in memory and cannot be exported; every save encrypts the whole board with a fresh IV and writes only ciphertext to localStorage. A wrong passphrase simply fails the GCM integrity check. Cards move by pointer (mouse drag anywhere, touch and pen from the grip so the page still scrolls) or by keyboard: focus a grip, press Space, use the arrow keys, and press Space again, with every step announced to screen readers. Plain-JSON import is validated with zod before it replaces anything.',
  limits: [
    'Data lives only in this browser. Clearing site data deletes every vault, and a forgotten passphrase cannot be recovered.',
    'This is per-browser isolation, not a server account: there is no sync between devices. Each save rewrites only its own vault, so other vaults are safe, but two tabs editing the same vault overwrite each other (last save wins).',
    'Plain-JSON exports are not encrypted. Use the encrypted backup to move a vault safely.',
    'Web Crypto only runs on HTTPS pages, which this site is.',
  ],
  stack: ['Web Crypto (PBKDF2, AES-GCM)', 'Pointer Events', 'React 19', 'Zod', 'localStorage'],
}
