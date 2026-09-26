/**
 * The playground database: a small, fictional shop (customers, products, orders, line items)
 * and a staff table with departments and managers. Generated from a fixed seed, so every
 * visitor, and every checker run, gets identical data.
 */
import { seeded } from '@/lib/utils'

export const SCHEMA_SQL = `
CREATE TABLE departments (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);
CREATE TABLE employees (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  department_id  INTEGER NOT NULL REFERENCES departments(id),
  manager_id     INTEGER REFERENCES employees(id),
  salary         INTEGER NOT NULL,
  hired_on       DATE NOT NULL
);
CREATE TABLE customers (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  country     TEXT NOT NULL,
  joined_on   DATE NOT NULL
);
CREATE TABLE products (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  category  TEXT NOT NULL,
  price     REAL NOT NULL
);
CREATE TABLE orders (
  id           INTEGER PRIMARY KEY,
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  ordered_at   DATE NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('paid', 'shipped', 'cancelled'))
);
CREATE TABLE order_items (
  order_id    INTEGER NOT NULL REFERENCES orders(id),
  product_id  INTEGER NOT NULL REFERENCES products(id),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  REAL NOT NULL,
  PRIMARY KEY (order_id, product_id)
);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_items_product ON order_items(product_id);
`.trim()

const FIRST = ['Amara', 'Bilal', 'Chen', 'Dara', 'Elif', 'Farid', 'Greta', 'Hana', 'Idris', 'Jonas', 'Kavya', 'Luis', 'Mina', 'Noor', 'Omar', 'Priya', 'Quinn', 'Rosa', 'Sami', 'Tariq', 'Uma', 'Viktor', 'Wen', 'Yara', 'Zain', 'Ines', 'Leo', 'Maya', 'Nico', 'Sofia']
const LAST = ['Okafor', 'Rahman', 'Li', 'Novak', 'Yilmaz', 'Haddad', 'Berg', 'Sato', 'Mensah', 'Weber', 'Iyer', 'Garcia', 'Park', 'Aziz', 'Farouk', 'Nair', 'Kelly', 'Moreno', 'Kurt', 'Qureshi', 'Das', 'Petrov', 'Zhou', 'Silva', 'Ortiz', 'Costa', 'Rossi', 'Cohen', 'Dubois', 'Lopez']
const COUNTRIES = ['Pakistan', 'United Kingdom', 'Germany', 'United States', 'Japan', 'Brazil']
const PRODUCTS: Array<[string, string, number]> = [
  ['Field notebook', 'Stationery', 6.5], ['Graph paper pad', 'Stationery', 4.25], ['Fineliner set', 'Stationery', 12],
  ['Brass ruler', 'Stationery', 18], ['Soil thermometer', 'Instruments', 24.9], ['Rain gauge', 'Instruments', 19.5],
  ['Hand lens 10x', 'Instruments', 15], ['Pocket anemometer', 'Instruments', 48], ['Core sampler', 'Instruments', 89],
  ['Canvas satchel', 'Bags', 42], ['Dry bag 10 L', 'Bags', 21], ['Map case', 'Bags', 16],
  ['Risograph poster', 'Prints', 30], ['Contour map print', 'Prints', 24], ['Almanac 2026', 'Prints', 14.5],
  ['Headlamp', 'Gear', 27], ['Enamel mug', 'Gear', 11], ['Trowel', 'Gear', 13.75], ['Seed tray', 'Gear', 9],
  ['Weather radio', 'Gear', 89],
]
const DEPTS = ['Engineering', 'Operations', 'Design', 'Sales']
const STATUSES = ['paid', 'shipped', 'shipped', 'shipped', 'paid', 'cancelled'] as const

const q = (s: string) => `'${s.replace(/'/g, "''")}'`
const pad = (n: number) => String(n).padStart(2, '0')

function dateFrom(rnd: () => number, startYear: number, months: number) {
  const m = Math.floor(rnd() * months)
  const y = startYear + Math.floor(m / 12)
  const d = 1 + Math.floor(rnd() * 28)
  return `${y}-${pad((m % 12) + 1)}-${pad(d)}`
}

export function buildSeedSql(seed = 2026): string {
  const rnd = seeded(seed)
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]
  const out: string[] = [SCHEMA_SQL, 'BEGIN;']

  DEPTS.forEach((d, i) => out.push(`INSERT INTO departments VALUES (${i + 1}, ${q(d)});`))

  // Employees: one head per department (no manager), then staff reporting to a head or a lead.
  let eid = 0
  const heads: number[] = []
  const staff: Array<{ id: number; dept: number; salary: number }> = []
  DEPTS.forEach((_, di) => {
    const id = ++eid
    const salary = 9000 + Math.round(rnd() * 30) * 100
    heads.push(id)
    staff.push({ id, dept: di + 1, salary })
    out.push(`INSERT INTO employees VALUES (${id}, ${q(`${FIRST[(id * 7) % 30]} ${LAST[(id * 11) % 30]}`)}, ${di + 1}, NULL, ${salary}, ${q(dateFrom(rnd, 2019, 24))});`)
  })
  for (let k = 0; k < 18; k++) {
    const dept = (k % DEPTS.length) + 1
    const id = ++eid
    const peers = staff.filter((s) => s.dept === dept)
    const manager = rnd() < 0.7 ? heads[dept - 1] : pick(peers).id
    // A few people out-earn their manager, and some salaries tie, so the challenges have teeth.
    const salary = k % 7 === 3 ? 12500 : 4000 + Math.round(rnd() * 60) * 100
    staff.push({ id, dept, salary })
    out.push(`INSERT INTO employees VALUES (${id}, ${q(`${FIRST[(id * 7) % 30]} ${LAST[(id * 13 + 3) % 30]}`)}, ${dept}, ${manager}, ${salary}, ${q(dateFrom(rnd, 2020, 60))});`)
  }

  // Customers: three share an email with someone else (a data-quality bug to find).
  const customers = 30
  for (let id = 1; id <= customers; id++) {
    const first = FIRST[(id * 17) % 30]
    const last = LAST[(id * 23 + 5) % 30]
    const dup = id === 12 ? 3 : id === 21 ? 8 : id === 30 ? 3 : 0
    const emailOwner = dup || id
    const email = `${FIRST[(emailOwner * 17) % 30]}.${LAST[(emailOwner * 23 + 5) % 30]}@example.com`.toLowerCase()
    out.push(`INSERT INTO customers VALUES (${id}, ${q(`${first} ${last}`)}, ${q(email)}, ${q(pick(COUNTRIES))}, ${q(dateFrom(rnd, 2024, 18))});`)
  }

  PRODUCTS.forEach(([name, cat, price], i) => out.push(`INSERT INTO products VALUES (${i + 1}, ${q(name)}, ${q(cat)}, ${price});`))

  // Orders across 2025, from customers 1..26 (27..30 never order).
  for (let id = 1; id <= 140; id++) {
    const customer = 1 + Math.floor(Math.pow(rnd(), 1.4) * 26)
    out.push(`INSERT INTO orders VALUES (${id}, ${customer}, ${q(dateFrom(rnd, 2025, 12))}, ${q(pick(STATUSES))});`)
    const lines = 1 + Math.floor(rnd() * 3)
    const used = new Set<number>()
    for (let l = 0; l < lines; l++) {
      const p = 1 + Math.floor(rnd() * PRODUCTS.length)
      if (used.has(p)) continue
      used.add(p)
      const qty = 1 + Math.floor(Math.pow(rnd(), 2) * 4)
      out.push(`INSERT INTO order_items VALUES (${id}, ${p}, ${qty}, ${PRODUCTS[p - 1][2]});`)
    }
  }
  out.push('COMMIT;')
  return out.join('\n')
}
