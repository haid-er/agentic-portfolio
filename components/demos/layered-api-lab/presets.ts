/** One-click requests that each exercise a different path through the layers. */
export type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface Preset {
  id: string
  label: string
  method: Method
  path: string
  body?: string
  /** What to look at in the trace. */
  watch: string
}

const pretty = (v: unknown) => JSON.stringify(v, null, 2)

export const PRESETS: readonly Preset[] = [
  { id: 'list', label: 'List sites', method: 'GET', path: '/sites', watch: 'Happy path: every layer runs once and the repository reports its query.' },
  { id: 'filter', label: 'Filter + limit', method: 'GET', path: '/sites?country=GB&limit=2', watch: 'The query string is coerced by Zod (limit "2" becomes the number 2) before the controller sees it.' },
  { id: 'get', label: 'Get one', method: 'GET', path: '/sites/1', watch: 'Route params are validated too: the id is coerced to a positive integer.' },
  {
    id: 'create', label: 'Create (valid)', method: 'POST', path: '/sites',
    body: pretty({ name: 'Canal Workshop', country: 'GB', scope: 1, emissionsTCO2e: 42.5, reportingYear: 2025 }),
    watch: 'The service checks for duplicates, the repository inserts, and the controller answers 201 with a Location header.',
  },
  {
    id: 'invalid', label: 'Create (Zod errors)', method: 'POST', path: '/sites',
    body: pretty({ name: 'X', country: 'gbr', scope: 4, emissionsTCO2e: -3, extra: true }),
    watch: 'Validation middleware stops the request: the controller never runs, and every issue comes back with its path.',
  },
  { id: 'malformed', label: 'Malformed JSON', method: 'POST', path: '/sites', body: '{ "name": "Half a body", ', watch: 'The body parser throws before validation; the error handler turns it into a 400.' },
  {
    id: 'dupe', label: 'Duplicate (409)', method: 'POST', path: '/sites',
    body: pretty({ name: 'North Plant', country: 'GB', scope: 1, emissionsTCO2e: 1, reportingYear: 2025 }),
    watch: 'Input is valid, but a business rule in the service rejects it: the repository insert never happens.',
  },
  { id: 'missing', label: 'Not found (404)', method: 'GET', path: '/sites/999', watch: 'The repository returns nothing; the service throws NotFoundError; the error handler maps it to 404.' },
  { id: 'patch', label: 'Patch one', method: 'PATCH', path: '/sites/2', body: pretty({ emissionsTCO2e: 295.7 }), watch: 'A partial schema: only the fields sent are validated and updated.' },
  { id: 'delete', label: 'Delete (204)', method: 'DELETE', path: '/sites/3', watch: 'The service checks the row exists first, so a second delete returns 404.' },
  { id: 'method', label: 'Wrong method (405)', method: 'PUT', path: '/sites/1', watch: 'The router knows the path but not the verb, and answers with an Allow header.' },
  { id: 'crash', label: 'Crash (500)', method: 'GET', path: '/debug/crash', watch: 'An unexpected TypeError: the client gets a generic message and a request id; the stack goes only to the log.' },
]
