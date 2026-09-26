/**
 * Binary min-heap keyed by (priority, tie). Used as the open set for Dijkstra and A*.
 * Hand-written on purpose: this demo is about the data structures.
 */
export class MinHeap {
  private keys: number[] = []
  private ties: number[] = []
  private items: number[] = []

  get size() { return this.items.length }

  push(item: number, key: number, tie = 0) {
    this.items.push(item); this.keys.push(key); this.ties.push(tie)
    this.up(this.items.length - 1)
  }

  pop(): number | undefined {
    const n = this.items.length
    if (!n) return undefined
    const top = this.items[0]
    this.swap(0, n - 1)
    this.items.pop(); this.keys.pop(); this.ties.pop()
    this.down(0)
    return top
  }

  private less(a: number, b: number) {
    return this.keys[a] < this.keys[b] || (this.keys[a] === this.keys[b] && this.ties[a] < this.ties[b])
  }

  private swap(a: number, b: number) {
    ;[this.items[a], this.items[b]] = [this.items[b], this.items[a]]
    ;[this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]]
    ;[this.ties[a], this.ties[b]] = [this.ties[b], this.ties[a]]
  }

  private up(i: number) {
    while (i > 0) {
      const p = (i - 1) >> 1
      if (!this.less(i, p)) return
      this.swap(i, p)
      i = p
    }
  }

  private down(i: number) {
    const n = this.items.length
    for (;;) {
      const l = 2 * i + 1
      const r = l + 1
      let m = i
      if (l < n && this.less(l, m)) m = l
      if (r < n && this.less(r, m)) m = r
      if (m === i) return
      this.swap(i, m)
      i = m
    }
  }
}
