// Elysia turns any thrown error with toResponse() into that response.
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string, cause?: unknown) {
    super(message, { cause });
    this.status = status;
  }

  toResponse() {
    return Response.json({ message: this.message }, { status: this.status });
  }
}
