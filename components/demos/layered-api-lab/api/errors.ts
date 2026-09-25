/** Typed HTTP errors. Layers throw these; only the error handler turns them into responses. */

export interface IssueOut { path: string; message: string; code: string }

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: { issues?: IssueOut[]; allow?: string[] },
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class ValidationError extends HttpError {
  constructor(where: string, issues: IssueOut[]) {
    super(400, 'VALIDATION_FAILED', `Request ${where} failed validation`, { issues })
  }
}

export class MalformedJsonError extends HttpError {
  constructor(reason: string) {
    super(400, 'MALFORMED_JSON', `Body is not valid JSON: ${reason}`)
  }
}

export class NotFoundError extends HttpError {
  constructor(what: string) {
    super(404, 'NOT_FOUND', `${what} not found`)
  }
}

export class MethodNotAllowedError extends HttpError {
  constructor(method: string, allow: string[]) {
    super(405, 'METHOD_NOT_ALLOWED', `${method} is not allowed here`, { allow })
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, 'CONFLICT', message)
  }
}

export class PayloadTooLargeError extends HttpError {
  constructor(limit: number) {
    super(413, 'PAYLOAD_TOO_LARGE', `Body is larger than ${limit} bytes`)
  }
}

export class UnprocessableError extends HttpError {
  constructor(message: string) {
    super(422, 'UNPROCESSABLE', message)
  }
}
