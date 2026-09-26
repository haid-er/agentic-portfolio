/**
 * LeetCode-style SQL challenges on the playground data. Each has a reference query (run on a
 * fresh copy to produce the expected rows), the expected columns, whether row order matters,
 * a hint, dialect notes for PostgreSQL and MySQL, and the same query in Drizzle ORM.
 */
export interface Challenge {
  id: string
  title: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  concepts: string[]
  prompt: string
  columns: string[]
  ordered: boolean
  hint: string
  solution: string
  postgres: string
  mysql: string
  drizzle: string
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'never-ordered',
    title: 'Customers who never ordered',
    difficulty: 'Easy',
    concepts: ['LEFT JOIN', 'NOT EXISTS'],
    prompt: 'List the names of customers who have never placed an order (any status counts as an order).',
    columns: ['name'],
    ordered: false,
    hint: 'LEFT JOIN orders and keep the rows where the order side is NULL, or use NOT EXISTS.',
    solution: `SELECT c.name
FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.customer_id = c.id
);`,
    postgres: 'Identical. The planner turns NOT EXISTS into an anti-join; NOT IN would misbehave if orders.customer_id could be NULL.',
    mysql: 'Identical in MySQL 8. LEFT JOIN … WHERE o.id IS NULL is the classic form and is also executed as an anti-join.',
    drizzle: `db.select({ name: customers.name })
  .from(customers)
  .leftJoin(orders, eq(orders.customerId, customers.id))
  .where(isNull(orders.id));`,
  },
  {
    id: 'duplicate-emails',
    title: 'Duplicate emails',
    difficulty: 'Easy',
    concepts: ['GROUP BY', 'HAVING'],
    prompt: 'Find every email address that belongs to more than one customer row. Return each such email once.',
    columns: ['email'],
    ordered: false,
    hint: 'Group by email and filter the groups with HAVING, not WHERE.',
    solution: `SELECT email
FROM customers
GROUP BY email
HAVING COUNT(*) > 1;`,
    postgres: 'Identical. A UNIQUE index on lower(email) would stop this at write time.',
    mysql: 'Identical. Note that MySQL’s default collation compares case-insensitively, SQLite’s does not.',
    drizzle: `db.select({ email: customers.email })
  .from(customers)
  .groupBy(customers.email)
  .having(sql\`count(*) > 1\`);`,
  },
  {
    id: 'second-price',
    title: 'Second highest price',
    difficulty: 'Medium',
    concepts: ['DISTINCT', 'LIMIT / OFFSET', 'scalar subquery'],
    prompt: 'Return the second highest distinct product price as a single column named second_highest. If there is no such price, the query must return one row containing NULL.',
    columns: ['second_highest'],
    ordered: true,
    hint: 'Two products share the top price, so you need DISTINCT. Wrapping the query in a scalar subquery turns “no row” into NULL.',
    solution: `SELECT (
  SELECT DISTINCT price
  FROM products
  ORDER BY price DESC
  LIMIT 1 OFFSET 1
) AS second_highest;`,
    postgres: 'Identical. The window form also works: DENSE_RANK() OVER (ORDER BY price DESC) = 2.',
    mysql: 'Identical. MySQL also accepts LIMIT 1, 1 (offset first), which is easy to misread.',
    drizzle: `const second = db.selectDistinct({ price: products.price })
  .from(products)
  .orderBy(desc(products.price))
  .limit(1)
  .offset(1);
// then read second[0]?.price ?? null in TypeScript`,
  },
  {
    id: 'out-earn-manager',
    title: 'Earning more than their manager',
    difficulty: 'Easy',
    concepts: ['self join'],
    prompt: 'List employees whose salary is strictly greater than their manager’s salary. Return their names as employee.',
    columns: ['employee'],
    ordered: false,
    hint: 'Join employees to itself: one alias for the employee, one for the manager.',
    solution: `SELECT e.name AS employee
FROM employees e
JOIN employees m ON m.id = e.manager_id
WHERE e.salary > m.salary;`,
    postgres: 'Identical.',
    mysql: 'Identical.',
    drizzle: `const m = alias(employees, 'm');
db.select({ employee: employees.name })
  .from(employees)
  .innerJoin(m, eq(employees.managerId, m.id))
  .where(gt(employees.salary, m.salary));`,
  },
  {
    id: 'top-three-salaries',
    title: 'Top three salaries per department',
    difficulty: 'Hard',
    concepts: ['window functions', 'DENSE_RANK', 'PARTITION BY'],
    prompt: 'A high earner is someone whose salary is among the three highest distinct salaries in their department. Return department (its name), employee and salary for every high earner. Ties share a rank.',
    columns: ['department', 'employee', 'salary'],
    ordered: false,
    hint: 'DENSE_RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) gives equal salaries the same rank without gaps.',
    solution: `SELECT d.name AS department, e.name AS employee, e.salary
FROM (
  SELECT *, DENSE_RANK() OVER (
    PARTITION BY department_id ORDER BY salary DESC
  ) AS rnk
  FROM employees
) e
JOIN departments d ON d.id = e.department_id
WHERE e.rnk <= 3;`,
    postgres: 'Identical. Window functions cannot appear in WHERE directly, hence the subquery (or a CTE).',
    mysql: 'Needs MySQL 8.0 or later; 5.7 has no window functions and needs a correlated COUNT(DISTINCT …) subquery instead.',
    drizzle: `const ranked = db.$with('ranked').as(
  db.select({
    departmentId: employees.departmentId,
    employee: employees.name,
    salary: employees.salary,
    rnk: sql<number>\`dense_rank() over (partition by \${employees.departmentId} order by \${employees.salary} desc)\`.as('rnk'),
  }).from(employees),
);
db.with(ranked)
  .select({ department: departments.name, employee: ranked.employee, salary: ranked.salary })
  .from(ranked)
  .innerJoin(departments, eq(departments.id, ranked.departmentId))
  .where(lte(ranked.rnk, 3));`,
  },
  {
    id: 'monthly-revenue',
    title: 'Monthly revenue and running total',
    difficulty: 'Medium',
    concepts: ['CTE', 'window SUM', 'date functions'],
    prompt: 'For each month with sales (YYYY-MM), return month, revenue (sum of quantity × unit_price over non-cancelled orders) and running_total (revenue of that month and all earlier months). Order by month.',
    columns: ['month', 'revenue', 'running_total'],
    ordered: true,
    hint: 'Aggregate per month in a CTE, then SUM(revenue) OVER (ORDER BY month). In SQLite, strftime(\'%Y-%m\', ordered_at) gives the month.',
    solution: `WITH monthly AS (
  SELECT strftime('%Y-%m', o.ordered_at) AS month,
         ROUND(SUM(i.quantity * i.unit_price), 2) AS revenue
  FROM orders o
  JOIN order_items i ON i.order_id = o.id
  WHERE o.status <> 'cancelled'
  GROUP BY month
)
SELECT month, revenue,
       ROUND(SUM(revenue) OVER (ORDER BY month), 2) AS running_total
FROM monthly
ORDER BY month;`,
    postgres: "Use to_char(o.ordered_at, 'YYYY-MM') or date_trunc('month', o.ordered_at). Money should be numeric(10,2), not a float.",
    mysql: "Use DATE_FORMAT(o.ordered_at, '%Y-%m'). Window SUM needs MySQL 8.0+.",
    drizzle: `const month = sql<string>\`strftime('%Y-%m', \${orders.orderedAt})\`; // pg: to_char(…, 'YYYY-MM')
const monthly = db.$with('monthly').as(
  db.select({ month: month.as('month'), revenue: sql<number>\`sum(\${orderItems.quantity} * \${orderItems.unitPrice})\`.as('revenue') })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(ne(orders.status, 'cancelled'))
    .groupBy(month),
);
db.with(monthly).select({
  month: monthly.month,
  revenue: monthly.revenue,
  runningTotal: sql<number>\`sum(\${monthly.revenue}) over (order by \${monthly.month})\`,
}).from(monthly).orderBy(monthly.month);`,
  },
  {
    id: 'category-best-seller',
    title: 'Best seller in each category',
    difficulty: 'Medium',
    concepts: ['multi-table JOIN', 'RANK'],
    prompt: 'For each product category, find the product that sold the most units across non-cancelled orders. Return category, product and units. If products tie for first place, return all of them.',
    columns: ['category', 'product', 'units'],
    ordered: false,
    hint: 'Sum units per product first, then RANK() within each category and keep rank 1. RANK keeps ties; ROW_NUMBER would drop them.',
    solution: `WITH units AS (
  SELECT p.category, p.name AS product, SUM(i.quantity) AS units
  FROM order_items i
  JOIN orders o   ON o.id = i.order_id
  JOIN products p ON p.id = i.product_id
  WHERE o.status <> 'cancelled'
  GROUP BY p.id
), ranked AS (
  SELECT *, RANK() OVER (PARTITION BY category ORDER BY units DESC) AS rnk
  FROM units
)
SELECT category, product, units FROM ranked WHERE rnk = 1;`,
    postgres: 'GROUP BY p.id works because id is the primary key (functional dependency). PostgreSQL also offers DISTINCT ON (category), but that drops ties.',
    mysql: 'GROUP BY p.id is accepted with ONLY_FULL_GROUP_BY for the same reason. RANK needs 8.0+.',
    drizzle: `const units = db.$with('units').as(
  db.select({
    category: products.category,
    product: sql<string>\`\${products.name}\`.as('product'),
    units: sql<number>\`sum(\${orderItems.quantity})\`.as('units'),
  })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(ne(orders.status, 'cancelled'))
    .groupBy(products.id),
);
// then rank() over (partition by category order by units desc) in a second CTE, as in the SQL`,
  },
  {
    id: 'cancel-rate',
    title: 'Cancellation rate by country',
    difficulty: 'Medium',
    concepts: ['conditional aggregation', 'ROUND', 'ORDER BY'],
    prompt: 'For each customer country, return country, orders (number of orders) and cancelled_pct: the percentage of those orders that were cancelled, rounded to 1 decimal place. Order by cancelled_pct descending, then country ascending.',
    columns: ['country', 'orders', 'cancelled_pct'],
    ordered: true,
    hint: 'SUM(o.status = \'cancelled\') counts matches in SQLite. Multiply by 100.0, not 100, or integer division rounds everything to 0.',
    solution: `SELECT c.country,
       COUNT(*) AS orders,
       ROUND(100.0 * SUM(o.status = 'cancelled') / COUNT(*), 1) AS cancelled_pct
FROM orders o
JOIN customers c ON c.id = o.customer_id
GROUP BY c.country
ORDER BY cancelled_pct DESC, c.country;`,
    postgres: "Booleans do not sum in PostgreSQL: use COUNT(*) FILTER (WHERE o.status = 'cancelled') or SUM(CASE WHEN … THEN 1 ELSE 0 END).",
    mysql: 'SUM(o.status = \'cancelled\') works as in SQLite, because comparisons return 0 or 1.',
    drizzle: `// PostgreSQL flavour: FILTER instead of summing booleans
const pct = sql<number>\`round(100.0 * count(*) filter (where \${orders.status} = 'cancelled') / count(*), 1)\`;
db.select({ country: customers.country, orders: count(), cancelledPct: pct })
  .from(orders)
  .innerJoin(customers, eq(customers.id, orders.customerId))
  .groupBy(customers.country)
  .orderBy(desc(pct), customers.country);`,
  },
]
