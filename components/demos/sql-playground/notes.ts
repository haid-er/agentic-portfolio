import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'SQLite itself, compiled to WebAssembly by the sql.js project, runs inside a Web Worker in your browser; there is no server and nothing you type leaves the page. On start the worker builds a small fictional shop and staff database from a fixed seed, so everyone sees the same rows. Check runs your query and a reference query on two fresh copies of that database, then compares the last result set: the same number of columns and the same rows, as a multiset or in order when the challenge says order matters, with numbers compared to two decimal places. The schema panel reads sqlite_master and PRAGMA table_info / foreign_key_list live, and can show the same tables as a Drizzle ORM schema for PostgreSQL. Each challenge notes where PostgreSQL and MySQL differ.',
  limits: [
    'The dialect is SQLite. PostgreSQL and MySQL differences are explained per challenge, not executed.',
    'A query that runs longer than 4 seconds stops the worker; the database then restarts from the seed data.',
    'Results show at most 500 rows per statement.',
    'The data is fictional and generated; it does not describe real people or sales.',
    'Your drafts, solved challenges and history stay in this browser (localStorage). Changes to the database last until you reload or press Reset database.',
  ],
  stack: ['sql.js (SQLite → WebAssembly)', 'Web Workers', 'TypeScript', 'React 19', 'Drizzle ORM (generated schema)'],
}
