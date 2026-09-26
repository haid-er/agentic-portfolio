/**
 * Problem set for the code judge. Each problem has visible samples, a seeded hidden test
 * generator, a reference solution (to compute expected outputs) and, where many answers are
 * valid, a custom checker. Large hidden tests are sized so a quadratic solution exceeds the limit.
 */
import { seeded } from '@/lib/utils'

export type Args = unknown[]

export interface TestCase {
  args: Args
  /** Shown for hidden tests instead of the data ("n = 100000, answer at the end"). */
  label: string
}

export interface Sample {
  args: Args
  note?: string
}

export interface Problem {
  id: string
  title: string
  difficulty: 'Easy' | 'Medium'
  tags: string[]
  statement: string[]
  params: string[]
  returns: string
  constraints: string[]
  starter: string
  /** A correct but slow solution, to show what TLE looks like. */
  naive: string
  editorial: string
  /** How the same idea is usually written in C++. */
  cpp: string
  timeLimitMs: number
  samples: Sample[]
  hidden: (rnd: () => number) => TestCase[]
  reference: (...args: never[]) => unknown
  /** Custom checker when several outputs are correct. Default: deep equality. */
  check?: (args: Args, got: unknown, expected: unknown) => boolean
}

const int = (rnd: () => number, lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1))

/* ---------------------------------------------------------------- 1. pair sum */

function twoSumRef(nums: number[], target: number): number[] {
  const seen = new Map<number, number>()
  for (let i = 0; i < nums.length; i++) {
    const j = seen.get(target - nums[i])
    if (j !== undefined) return [j, i]
    if (!seen.has(nums[i])) seen.set(nums[i], i)
  }
  return []
}

/** Only the last two elements can form the target: every other value is odd, target is odd. */
function pairAtEnd(rnd: () => number, n: number) {
  const target = 2 * int(rnd, 1, 4e8) + 1
  const even = 2 * int(rnd, 1, 2e8)
  const odd = target - even
  const nums: number[] = []
  while (nums.length < n - 2) {
    const v = 2 * int(rnd, 0, 5e8) + 1
    if (v !== odd) nums.push(v)
  }
  nums.push(even, odd)
  return [nums, target] as Args
}

function randomPair(rnd: () => number, n: number, span: number): Args {
  const nums = Array.from({ length: n }, () => int(rnd, -span, span))
  const i = int(rnd, 0, n - 2)
  const j = int(rnd, i + 1, n - 1)
  return [nums, nums[i] + nums[j]]
}

const pairSum: Problem = {
  id: 'pair-sum',
  title: 'Pair with target sum',
  difficulty: 'Easy',
  tags: ['hash map', 'arrays'],
  statement: [
    'Given an array of integers nums and an integer target, return the indices [i, j] of two different elements whose values add up to target.',
    'At least one such pair exists. If there are several, any one is accepted.',
  ],
  params: ['nums: number[]', 'target: number'],
  returns: 'number[]: two distinct indices',
  constraints: ['2 ≤ nums.length ≤ 100 000', '−10⁹ ≤ nums[i], target ≤ 10⁹'],
  starter: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]} two distinct indices
 */
function solve(nums, target) {
  // your code here
  return [];
}
`,
  naive: `// Brute force: try every pair. Correct, but O(n²).
function solve(nums, target) {
  for (let i = 0; i < nums.length; i++)
    for (let j = i + 1; j < nums.length; j++)
      if (nums[i] + nums[j] === target) return [i, j];
  return [];
}
`,
  editorial: 'Walk the array once, keeping a map from value to index. For each element, look up target − value: if it was seen before, you have the pair. One pass, O(n) time and O(n) memory.',
  cpp: 'std::unordered_map<int, int> seen; for (int i = 0; i < n; ++i) { auto it = seen.find(target - a[i]); if (it != seen.end()) return {it->second, i}; seen.emplace(a[i], i); }',
  timeLimitMs: 1000,
  samples: [
    { args: [[2, 7, 11, 15], 9], note: 'nums[0] + nums[1] = 9' },
    { args: [[3, 2, 4], 6] },
    { args: [[3, 3], 6], note: 'the same value twice, at different indices' },
  ],
  hidden: (rnd) => [
    { args: [[1, -1], 0], label: 'n = 2, negatives' },
    { args: [[0, 4, 3, 0], 0], label: 'zeros' },
    { args: [[-3, 4, 3, 90], 0], label: 'negative + positive' },
    { args: randomPair(rnd, 10, 20), label: 'n = 10, random' },
    { args: randomPair(rnd, 1000, 1000), label: 'n = 1 000, random' },
    { args: randomPair(rnd, 50_000, 1e9), label: 'n = 50 000, large values' },
    { args: pairAtEnd(rnd, 100_000), label: 'n = 100 000, the only pair is at the end' },
  ],
  reference: twoSumRef as Problem['reference'],
  check: (args, got) => {
    const [nums, target] = args as [number[], number]
    if (!Array.isArray(got) || got.length !== 2) return false
    const [i, j] = got as unknown[]
    if (!Number.isInteger(i) || !Number.isInteger(j)) return false
    const a = i as number, b = j as number
    return a !== b && a >= 0 && b >= 0 && a < nums.length && b < nums.length && nums[a] + nums[b] === target
  },
}

/* ---------------------------------------------------------------- 2. max subarray */

function kadane(nums: number[]): number {
  let best = nums[0]
  let cur = 0
  for (const v of nums) {
    cur = Math.max(v, cur + v)
    best = Math.max(best, cur)
  }
  return best
}

const maxSubarray: Problem = {
  id: 'max-subarray',
  title: 'Maximum subarray sum',
  difficulty: 'Medium',
  tags: ['dynamic programming', 'Kadane'],
  statement: [
    'Given an integer array nums, return the largest sum of any non-empty contiguous subarray.',
  ],
  params: ['nums: number[]'],
  returns: 'number',
  constraints: ['1 ≤ nums.length ≤ 200 000', '−10 000 ≤ nums[i] ≤ 10 000'],
  starter: `/**
 * @param {number[]} nums
 * @return {number}
 */
function solve(nums) {
  // your code here
  return 0;
}
`,
  naive: `// Brute force: every start, every end. O(n²).
function solve(nums) {
  let best = -Infinity;
  for (let i = 0; i < nums.length; i++) {
    let sum = 0;
    for (let j = i; j < nums.length; j++) {
      sum += nums[j];
      if (sum > best) best = sum;
    }
  }
  return best;
}
`,
  editorial: 'Kadane: the best subarray ending at i either extends the best one ending at i − 1 or starts fresh at i, so cur = max(nums[i], cur + nums[i]). Track the maximum of cur. O(n) time, O(1) memory. Beware the all-negative case: returning 0 is wrong.',
  cpp: 'long long best = a[0], cur = 0; for (int v : a) { cur = std::max<long long>(v, cur + v); best = std::max(best, cur); } // long long: n·10⁴ can overflow int in general',
  timeLimitMs: 1000,
  samples: [
    { args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], note: '[4, −1, 2, 1] sums to 6' },
    { args: [[5, 4, -1, 7, 8]] },
    { args: [[-3, -1, -2]], note: 'all negative: the answer is not 0' },
  ],
  hidden: (rnd) => [
    { args: [[7]], label: 'n = 1' },
    { args: [[-10000]], label: 'n = 1, negative' },
    { args: [Array.from({ length: 50 }, () => -int(rnd, 1, 100))], label: 'all negative' },
    { args: [Array.from({ length: 50 }, () => int(rnd, 0, 100))], label: 'all non-negative' },
    { args: [Array.from({ length: 1000 }, () => int(rnd, -100, 100))], label: 'n = 1 000, random' },
    { args: [Array.from({ length: 200_000 }, () => int(rnd, -10_000, 10_000))], label: 'n = 200 000, random' },
    { args: [Array.from({ length: 200_000 }, (_, i) => (i % 2 ? -1 : 10_000))], label: 'n = 200 000, alternating' },
  ],
  reference: kadane as Problem['reference'],
}

/* ---------------------------------------------------------------- 3. count primes */

function sieveCount(n: number): number {
  if (n < 3) return 0
  const composite = new Uint8Array(n)
  let count = 0
  for (let i = 2; i < n; i++) {
    if (composite[i]) continue
    count++
    for (let j = i * i; j < n; j += i) composite[j] = 1
  }
  return count
}

const countPrimes: Problem = {
  id: 'count-primes',
  title: 'Count primes below n',
  difficulty: 'Medium',
  tags: ['math', 'sieve'],
  statement: ['Return the number of prime numbers strictly less than n.'],
  params: ['n: number'],
  returns: 'number',
  constraints: ['0 ≤ n ≤ 10 000 000'],
  starter: `/**
 * @param {number} n
 * @return {number}
 */
function solve(n) {
  // your code here
  return 0;
}
`,
  naive: `// Trial division for every number. Fine for small n, far too slow at 10⁷.
function solve(n) {
  let count = 0;
  for (let k = 2; k < n; k++) {
    let prime = true;
    for (let d = 2; d * d <= k; d++) if (k % d === 0) { prime = false; break; }
    if (prime) count++;
  }
  return count;
}
`,
  editorial: 'Sieve of Eratosthenes: mark multiples of each prime p starting at p², because smaller multiples were already marked by smaller primes. O(n log log n) time. A Uint8Array keeps 10⁷ flags in about 10 MB.',
  cpp: 'std::vector<bool> comp(n); int count = 0; for (long long i = 2; i < n; ++i) if (!comp[i]) { ++count; for (long long j = i * i; j < n; j += i) comp[j] = true; }',
  timeLimitMs: 1500,
  samples: [
    { args: [10], note: '2, 3, 5, 7' },
    { args: [0] },
    { args: [100] },
  ],
  hidden: () => [
    { args: [1], label: 'n = 1' },
    { args: [2], label: 'n = 2 (strictly less)' },
    { args: [3], label: 'n = 3' },
    { args: [1000], label: 'n = 1 000' },
    { args: [1_000_000], label: 'n = 1 000 000' },
    { args: [10_000_000], label: 'n = 10 000 000' },
  ],
  reference: sieveCount as Problem['reference'],
}

/* ---------------------------------------------------------------- 4. brackets */

function bracketsRef(s: string): boolean {
  const open: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
  const stack: string[] = []
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') stack.push(ch)
    else if (stack.pop() !== open[ch]) return false
  }
  return stack.length === 0
}

function balanced(rnd: () => number, pairs: number): string {
  const kinds = ['()', '[]', '{}']
  const out: string[] = []
  const stack: string[] = []
  let left = pairs
  while (left > 0 || stack.length) {
    if (left > 0 && (stack.length === 0 || rnd() < 0.55)) {
      const k = kinds[int(rnd, 0, 2)]
      out.push(k[0]); stack.push(k[1]); left--
    } else out.push(stack.pop() as string)
  }
  return out.join('')
}

const brackets: Problem = {
  id: 'brackets',
  title: 'Balanced brackets',
  difficulty: 'Easy',
  tags: ['stack', 'strings'],
  statement: [
    'Given a string s made of the characters ( ) [ ] { }, return true if every bracket is closed by the same kind of bracket, in the correct order.',
  ],
  params: ['s: string'],
  returns: 'boolean',
  constraints: ['0 ≤ s.length ≤ 200 000'],
  starter: `/**
 * @param {string} s
 * @return {boolean}
 */
function solve(s) {
  // your code here
  return false;
}
`,
  naive: `// Keep deleting adjacent pairs until nothing changes. Correct, but O(n²) on deep nesting.
function solve(s) {
  let prev;
  do {
    prev = s;
    s = s.replace('()', '').replace('[]', '').replace('{}', '');
  } while (s !== prev);
  return s.length === 0;
}
`,
  editorial: 'Push opening brackets on a stack; on a closing bracket, the top of the stack must be its partner. At the end the stack must be empty. O(n) time and memory.',
  cpp: 'std::string st; for (char c : s) { if (c == \'(\' || c == \'[\' || c == \'{\') st.push_back(c); else { if (st.empty() || st.back() != match(c)) return false; st.pop_back(); } } return st.empty();',
  timeLimitMs: 1000,
  samples: [
    { args: ['()[]{}'] },
    { args: ['([)]'], note: 'crossed pairs are not balanced' },
    { args: ['{[]}'] },
  ],
  hidden: (rnd) => [
    { args: [''], label: 'empty string' },
    { args: ['('], label: 'single opener' },
    { args: [']'], label: 'single closer' },
    { args: ['(]'], label: 'mismatched kinds' },
    { args: ['(('], label: 'unclosed' },
    { args: [balanced(rnd, 500)], label: 'random balanced, length 1 000' },
    { args: [balanced(rnd, 500) + ')'], label: 'random, one extra closer' },
    { args: ['('.repeat(100_000) + ')'.repeat(100_000)], label: 'depth 100 000' },
    { args: ['['.repeat(100_000) + ')'.repeat(100_000)], label: 'depth 100 000, wrong kind' },
  ],
  reference: bracketsRef as Problem['reference'],
}

/* ---------------------------------------------------------------- 5. lower bound */

function lowerBoundRef(nums: number[], queries: number[]): number[] {
  return queries.map((q) => {
    let lo = 0, hi = nums.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (nums[mid] < q) lo = mid + 1; else hi = mid
    }
    return lo
  })
}

function sortedArray(rnd: () => number, n: number, maxStep: number) {
  const a: number[] = []
  let v = int(rnd, -1000, 1000)
  for (let i = 0; i < n; i++) { v += int(rnd, 0, maxStep); a.push(v) }
  return a
}

function queriesFor(rnd: () => number, a: number[], q: number) {
  const lo = a[0] - 5, hi = a[a.length - 1] + 5
  return Array.from({ length: q }, () => int(rnd, lo, hi))
}

const lowerBound: Problem = {
  id: 'lower-bound',
  title: 'Lower bound queries',
  difficulty: 'Medium',
  tags: ['binary search'],
  statement: [
    'nums is sorted in non-decreasing order. For every value q in queries, find the first index i with nums[i] ≥ q, or nums.length if there is none.',
    'Return the answers in query order.',
  ],
  params: ['nums: number[]', 'queries: number[]'],
  returns: 'number[]',
  constraints: ['1 ≤ nums.length, queries.length ≤ 100 000', 'nums is sorted, values fit in 32 bits'],
  starter: `/**
 * @param {number[]} nums  sorted, non-decreasing
 * @param {number[]} queries
 * @return {number[]}
 */
function solve(nums, queries) {
  // your code here
  return [];
}
`,
  naive: `// Linear scan per query: O(n · q).
function solve(nums, queries) {
  return queries.map((q) => {
    let i = 0;
    while (i < nums.length && nums[i] < q) i++;
    return i;
  });
}
`,
  editorial: 'Binary search on the half-open range [lo, hi): if nums[mid] < q the answer is right of mid, otherwise it is mid or left of it. Each query is O(log n), so the whole run is O(q log n). Off-by-one bugs live in the duplicates and "past the end" cases.',
  cpp: 'for (int q : queries) ans.push_back(std::lower_bound(a.begin(), a.end(), q) - a.begin());',
  timeLimitMs: 1000,
  samples: [
    { args: [[1, 3, 3, 5, 8], [0, 3, 4, 9]], note: '9 is past the end, so the answer is 5' },
    { args: [[2, 2, 2], [2, 1, 3]] },
  ],
  hidden: (rnd) => {
    const mid = sortedArray(rnd, 1000, 3)
    const big = sortedArray(rnd, 100_000, 50)
    return [
      { args: [[5], [4, 5, 6]], label: 'n = 1' },
      { args: [[1, 1, 1, 1], [1, 0, 2]], label: 'all equal' },
      { args: [[-5, -2, 0, 7], [-10, -2, -1, 8]], label: 'negatives' },
      { args: [mid, queriesFor(rnd, mid, 1000)], label: 'n = q = 1 000, many duplicates' },
      { args: [big, queriesFor(rnd, big, 100_000)], label: 'n = q = 100 000' },
    ]
  },
  reference: lowerBoundRef as Problem['reference'],
}

/* ---------------------------------------------------------------- 6. reverse bits */

function reverseBitsRef(n: number): number {
  let r = 0
  for (let i = 0; i < 32; i++) { r = (r << 1) | (n & 1); n >>>= 1 }
  return r >>> 0
}

const reverseBits: Problem = {
  id: 'reverse-bits',
  title: 'Reverse bits (uint32)',
  difficulty: 'Easy',
  tags: ['bit manipulation'],
  statement: [
    'Given n, an unsigned 32-bit integer, return the unsigned 32-bit integer whose binary digits are those of n in reverse order.',
    'JavaScript bitwise operators work on signed 32-bit values, so the result must be converted back to unsigned.',
  ],
  params: ['n: number (0 … 2³² − 1)'],
  returns: 'number (0 … 2³² − 1)',
  constraints: ['0 ≤ n < 2³²'],
  starter: `/**
 * @param {number} n  unsigned 32-bit
 * @return {number}   unsigned 32-bit
 */
function solve(n) {
  // your code here
  return 0;
}
`,
  naive: `// Via strings: correct and readable, but it allocates for every call.
function solve(n) {
  const bits = n.toString(2).padStart(32, '0');
  return parseInt(bits.split('').reverse().join(''), 2);
}
`,
  editorial: 'Shift the result left and pull in the lowest bit of n, 32 times. In JavaScript, << produces a signed value, so finish with r >>> 0 to reinterpret it as unsigned; in C this is simply uint32_t.',
  cpp: 'uint32_t r = 0; for (int i = 0; i < 32; ++i) { r = (r << 1) | (n & 1u); n >>= 1; } return r;',
  timeLimitMs: 500,
  samples: [
    { args: [43261596], note: '00000010100101000001111010011100 → 00111001011110000010100101000000' },
    { args: [4294967293] },
  ],
  hidden: (rnd) => [
    { args: [0], label: 'zero' },
    { args: [1], label: 'n = 1 (result has the top bit set)' },
    { args: [2147483648], label: 'n = 2³¹' },
    { args: [4294967295], label: 'all ones' },
    ...Array.from({ length: 8 }, (_, k) => ({ args: [Math.floor(rnd() * 2 ** 32)], label: `random value #${k + 1}` })),
  ],
  reference: reverseBitsRef as Problem['reference'],
}

export const PROBLEMS: Problem[] = [pairSum, brackets, reverseBits, maxSubarray, lowerBound, countPrimes]

/** Build the full, deterministic test list for a problem. */
export function buildTests(p: Problem, mode: 'samples' | 'submit'): Array<TestCase & { kind: 'sample' | 'hidden' }> {
  const samples = p.samples.map((s, i) => ({ args: s.args, label: `Sample ${i + 1}`, kind: 'sample' as const }))
  if (mode === 'samples') return samples
  const rnd = seeded(p.id.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7))
  return [...samples, ...p.hidden(rnd).map((t) => ({ ...t, kind: 'hidden' as const }))]
}

export function expectedFor(p: Problem, args: Args): unknown {
  // Reference solutions never mutate their inputs.
  return (p.reference as (...a: unknown[]) => unknown)(...args)
}

/** Deep equality for JSON-like values (numbers compared exactly; -0 equals 0). */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => sameValue(v, b[i]))
  if (a && b && typeof a === 'object') {
    const ka = Object.keys(a as object), kb = Object.keys(b as object)
    return ka.length === kb.length && ka.every((k) => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  }
  return false
}

export function isCorrect(p: Problem, args: Args, got: unknown, expected: unknown): boolean {
  return p.check ? p.check(args, got, expected) : sameValue(got, expected)
}

/** Compact, truncated preview of a value for the results panel. */
export function preview(v: unknown, max = 160): string {
  let s: string
  try { s = typeof v === 'string' ? JSON.stringify(v) : v === undefined ? 'undefined' : JSON.stringify(v) ?? String(v) } catch { s = String(v) }
  if (s === undefined) s = String(v)
  return s.length > max ? `${s.slice(0, max)}… (${s.length.toLocaleString('en-GB')} chars)` : s
}
