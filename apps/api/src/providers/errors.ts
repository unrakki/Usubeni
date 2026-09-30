// Elysia turns any thrown error with toResponse() into that response.
export class ProviderError extends Error {
  readonly status: 404 | 502 | 503;

  constructor(message: string, status: 404 | 502 | 503) {
    super(message);
    this.status = status;
  }

  toResponse() {
    return Response.json({ message: this.message }, { status: this.status });
  }
}
