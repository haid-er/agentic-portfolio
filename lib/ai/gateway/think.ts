/**
 * Removes <think>…</think> reasoning blocks that some open models (Qwen, DeepSeek R-style)
 * inline into their answer. Works on a stream: text that might be the start of a tag is
 * held back until the next chunk decides it.
 */
import 'server-only'

const OPEN = '<think>'
const CLOSE = '</think>'

export class ThinkFilter {
  private buf = ''
  private inside = false
  private started = false

  static strip(text: string): string {
    const f = new ThinkFilter()
    return (f.push(text) + f.flush()).trim()
  }

  /** Feed a chunk; returns the visible text that is safe to emit now. */
  push(chunk: string): string {
    this.buf += chunk
    let out = ''
    for (;;) {
      if (this.inside) {
        const end = this.buf.indexOf(CLOSE)
        if (end < 0) {
          this.buf = this.buf.slice(-(CLOSE.length - 1)) // keep a possible partial close tag
          return this.emit(out)
        }
        this.buf = this.buf.slice(end + CLOSE.length)
        this.inside = false
        continue
      }
      const start = this.buf.indexOf(OPEN)
      if (start >= 0) {
        out += this.buf.slice(0, start)
        this.buf = this.buf.slice(start + OPEN.length)
        this.inside = true
        continue
      }
      // Hold back a trailing fragment that could still become "<think>".
      const hold = partialSuffix(this.buf, OPEN)
      out += this.buf.slice(0, this.buf.length - hold)
      this.buf = this.buf.slice(this.buf.length - hold)
      return this.emit(out)
    }
  }

  /** End of stream: release anything held back (unless inside an unterminated block). */
  flush(): string {
    const rest = this.inside ? '' : this.buf
    this.buf = ''
    return this.emit(rest)
  }

  /** Drop leading whitespace left behind by a removed block at the very start. */
  private emit(s: string): string {
    if (this.started) return s
    const t = s.replace(/^\s+/, '')
    if (t) this.started = true
    return t
  }
}

function partialSuffix(s: string, tag: string): number {
  for (let n = Math.min(tag.length - 1, s.length); n > 0; n--) {
    if (s.endsWith(tag.slice(0, n))) return n
  }
  return 0
}
