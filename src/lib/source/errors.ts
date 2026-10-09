export class UpstreamError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "UpstreamError";
  }
}
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}
export class InvalidIdError extends Error {
  constructor(message = "Invalid id") {
    super(message);
    this.name = "InvalidIdError";
  }
}
export class RateLimitedError extends Error {
  constructor(message = "Rate limited") {
    super(message);
    this.name = "RateLimitedError";
  }
}
