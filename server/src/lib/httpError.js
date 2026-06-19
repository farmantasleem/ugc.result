/**
 * A small error type that carries an HTTP status code, so services can throw
 * meaningful failures and the route layer can map them to responses without
 * leaking internals.
 */
export class HttpError extends Error {
  /** @param {number} statusCode @param {string} message */
  constructor(statusCode, message) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
  }
}

export const badRequest = (msg) => new HttpError(400, msg)
export const badGateway = (msg) => new HttpError(502, msg)
