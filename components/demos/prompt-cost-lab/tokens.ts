/**
 * Offline token estimate. Text is split with a GPT-style pre-tokenizer regex
 * (words with their leading space, numbers in groups of three, punctuation runs),
 * then each piece is costed with rules of thumb for BPE vocabularies.
 * It is an estimate: every provider (and model generation) has its own tokenizer.
 */
const PIECE = /'(?:s|t|re|ve|m|ll|d)| ?\p{L}+| ?\p{N}{1,3}| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu

export interface Piece {
  text: string
  tokens: number
}

function cost(p: string): number {
  const core = p.trimStart()
  if (!core) return p.includes('\n') ? 1 : p.length > 1 ? 1 : 0
  if (/^\p{N}+$/u.test(core)) return 1
  if (/^\p{L}+$/u.test(core)) {
    // Non-Latin scripts (CJK, Arabic, Devanagari...) spend roughly a token per character or two.
    if (/[^\u0000-ɏ]/.test(core)) return Math.max(1, Math.ceil(core.length / (/[぀-鿿가-힯]/.test(core) ? 1 : 2)))
    const n = core.length
    return n <= 8 ? 1 : n <= 12 ? 2 : Math.ceil(n / 4.5)
  }
  return Math.max(1, Math.ceil(core.length / 2))
}

export function pieces(text: string): Piece[] {
  return (text.match(PIECE) ?? []).map((t) => ({ text: t, tokens: cost(t) }))
}

export function estimateTokens(text: string): number {
  let n = 0
  for (const p of text.match(PIECE) ?? []) n += cost(p)
  return n
}
