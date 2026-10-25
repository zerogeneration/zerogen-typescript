import type { ApiError } from "./types.js";

/**
 * An error response from the ZeroGen API. Branch on `code`, which is stable;
 * `message` is for people and can change.
 */
export class ZeroGenError extends Error {
  override readonly name = "ZeroGenError";
  /** The HTTP status. */
  readonly status: number;
  readonly code: string;
  /** The request field, header or query parameter at fault. */
  readonly param: string | undefined;
  /** Whether sending the same request again can succeed. */
  readonly retryable: boolean;
  readonly details: Record<string, unknown> | undefined;
  /** The response's `Request-Id`; quote it when contacting support. */
  readonly requestId: string | undefined;
  readonly headers: Headers;

  constructor(status: number, error: ApiError, headers: Headers) {
    super(error.message);
    this.status = status;
    this.code = error.code;
    this.param = error.param;
    this.retryable = error.retryable;
    this.details = error.details;
    this.requestId = headers.get("request-id") ?? undefined;
    this.headers = headers;
  }

  /** Reads an error response, including one that isn't ZeroGen's JSON envelope. */
  static async from(response: Response): Promise<ZeroGenError> {
    const text = await response.text().catch(() => "");
    let error: ApiError | undefined;
    try {
      error = (JSON.parse(text) as { error?: ApiError }).error;
    } catch {}
    if (typeof error?.code !== "string" || typeof error.message !== "string")
      error = {
        code: "unexpected_response",
        message: `HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
        retryable: response.status === 429 || response.status >= 500,
      };
    return new ZeroGenError(response.status, error, response.headers);
  }
}

/** The request got no response: the connection failed or the request timed out. */
export class ZeroGenConnectionError extends Error {
  override readonly name = "ZeroGenConnectionError";
}
