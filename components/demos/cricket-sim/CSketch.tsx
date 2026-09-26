/** How the engine maps onto C: an illustrative sketch (not the original repository's source). */

const SKETCH = `/* Illustrative sketch: how this engine's state maps onto C. */
typedef enum { YORKER, GOOD, SHORT, FULL, WIDE } Delivery;
typedef enum { LEAVE, DEFEND, NUDGE, DRIVE, PULL, LOFT } Shot;

typedef struct {
    char name[17];
    int runs, balls, fours, sixes;
    int out;                    /* 0 = not out */
} Batter;

typedef struct {
    Batter batters[11];
    int striker, non_striker, next_in;
    int runs, wickets, legal_balls;
    int wides, no_balls;
} Innings;

/* [delivery][shot] -> weights for 0,1,2,3,4,6,W */
static const int OUTCOME[5][6][7] = { /* ... */ };

int pick(const int *w, int n) {
    int total = 0, r, i;
    for (i = 0; i < n; i++) total += w[i];
    r = rand() % total;         /* srand(seed) once at start */
    for (i = 0; i < n; i++) if ((r -= w[i]) < 0) return i;
    return n - 1;
}`

export function CSketch() {
  return (
    <details className="group border border-rule rounded-1 bg-surface">
      <summary className="min-h-tap px-4 py-3 cursor-pointer mono text-ink-2 list-none flex items-center justify-between gap-2">
        <span>The engine, in C terms</span>
        <span aria-hidden="true" className="font-mono group-open:rotate-90 transition-transform duration-[var(--dur-fast)]">›</span>
      </summary>
      <div className="px-4 pb-4 grid gap-3">
        <p className="m-0 text-0 text-ink-2">
          The browser engine keeps to what a C program can do: plain structs, enums, lookup tables, integer maths and the
          ANSI C sample <code className="font-mono">rand()</code>. This sketch shows the shape. It is written for this demo, not taken from the original repository.
        </p>
        <pre className="m-0 p-3 overflow-x-auto bg-bg-2 border border-rule-soft rounded-0 font-mono text-00 leading-[1.6] text-ink" tabIndex={0} aria-label="C sketch of the engine state">
          {SKETCH}
        </pre>
      </div>
    </details>
  )
}
