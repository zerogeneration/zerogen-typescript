import { ZeroGenConnectionError, ZeroGenError } from "./errors.js";
import { Page, type PageBody, PagePromise } from "./pagination.js";
import { Generations } from "./resources/generations.js";
import { Models } from "./resources/models.js";
import { Uploads } from "./resources/uploads.js";
import type { Balance, BalanceQuery, Me } from "./types.js";
import { VERSION } from "./version.js";

export interface ClientOptions {
  /** Defaults to the `ZEROGEN_API_KEY` environment variable. */
  apiKey?: string;
  /** Defaults to the `ZEROGEN_BASE_URL` environment variable, then `https://api.zerogen.com/v1`. */
  baseURL?: string;
  /**
   * Milliseconds before one attempt of a request is abandoned. A request that
   * waits on a generation gets its wait added. Default 120,000.
   */
  timeout?: number;
  /** How many times to retry a connection error or a retryable response. Default 2. */
  maxRetries?: number;
  /** A `fetch` implementation to use instead of the global one. */
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
  /** Headers to send with every request. */
  defaultHeaders?: Record<string, string>;
}

export interface RequestOptions {
  /** Aborts the request, including any retry it's waiting on. */
  signal?: AbortSignal;
  /** Overrides the client's `timeout` for this request. */
  timeout?: number;
  /** Overrides the client's `maxRetries` for this request. */
  maxRetries?: number;
  /**
   * `POST` only. Each call sends a new random key by default and reuses it on
   * that call's retries; pass your own to make a retry across calls safe.
   */
  idempotencyKey?: string;
  /** Headers to send with this request. */
  headers?: Record<string, string>;
}

/** @internal */
export interface ApiCall {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Seconds the API may hold the response until a generation ends, sent as `Prefer: wait`. */
  wait?: number;
}

const DEFAULT_BASE_URL = "https://api.zerogen.com/v1";
const RETRY_AFTER_MAX_MS = 60_000;

/** A client for the ZeroGen API. */
export class ZeroGen {
  readonly baseURL: string;
  readonly timeout: number;
  readonly maxRetries: number;
  readonly generations: Generations;
  readonly models: Models;
  readonly uploads: Uploads;
  readonly #apiKey: string;
  readonly #fetch: (input: string, init: RequestInit) => Promise<Response>;
  readonly #headers: Record<string, string>;

  constructor(options: ClientOptions = {}) {
    const apiKey = options.apiKey ?? env("ZEROGEN_API_KEY");
    if (!apiKey) throw new Error("Pass apiKey or set the ZEROGEN_API_KEY environment variable.");
    this.#apiKey = apiKey;
    this.baseURL = (options.baseURL ?? env("ZEROGEN_BASE_URL") ?? DEFAULT_BASE_URL).replace(
      /\/+$/u,
      "",
    );
    this.timeout = options.timeout ?? 120_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.#fetch = (input, init) => (options.fetch ?? globalThis.fetch)(input, init);
    this.#headers = options.defaultHeaders ?? {};
    this.generations = new Generations(this);
    this.models = new Models(this);
    this.uploads = new Uploads(this);
  }

  /** The API key, the organization it belongs to, and what it can do. */
  me(options?: RequestOptions): Promise<Me> {
    return this.request({ method: "GET", path: "/me" }, options);
  }

  /** The organization's balance and spending limits, or a project's with `projectId`. */
  balance(query: BalanceQuery = {}, options?: RequestOptions): Promise<Balance> {
    return this.request({ method: "GET", path: "/balance", query }, options);
  }

  /** @internal */
  async request<Result>(call: ApiCall, options: RequestOptions = {}): Promise<Result> {
    const url = new URL(this.baseURL + call.path);
    for (const [name, value] of Object.entries(call.query ?? {}))
      if (value !== undefined) url.searchParams.set(name, String(value));
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": `zerogen-typescript/${VERSION}`,
      ...this.#headers,
      ...options.headers,
      Authorization: `Bearer ${this.#apiKey}`,
    };
    if (call.body !== undefined) headers["Content-Type"] = "application/json";
    if (call.method === "POST")
      headers["Idempotency-Key"] = options.idempotencyKey ?? crypto.randomUUID();
    if (call.wait !== undefined) headers.Prefer = `wait=${call.wait}`;
    const response = await this.send(
      url.toString(),
      {
        method: call.method,
        headers,
        body: call.body === undefined ? undefined : JSON.stringify(call.body),
      },
      { ...options, timeout: (options.timeout ?? this.timeout) + (call.wait ?? 0) * 1000 },
    );
    return (await response.json()) as Result;
  }

  /** @internal */
  list<Item>(call: ApiCall, options?: RequestOptions): PagePromise<Item> {
    const load = async (cursor?: string): Promise<Page<Item>> => {
      const query = cursor === undefined ? call.query : { ...call.query, cursor };
      const body = await this.request<PageBody<Item>>({ ...call, query }, options);
      return new Page(body, load);
    };
    return new PagePromise(() => load());
  }

  /**
   * @internal Sends a request, retrying connection errors and retryable
   * responses, and resolves with the first successful response. A `timeout`
   * of null sends without one.
   */
  async send(
    url: string,
    init: RequestInit,
    options: Omit<RequestOptions, "timeout"> & { timeout: number | null },
  ): Promise<Response> {
    const maxRetries = options.maxRetries ?? this.maxRetries;
    for (let attempt = 0; ; attempt++) {
      const signals = [
        options.signal,
        options.timeout === null ? undefined : AbortSignal.timeout(options.timeout),
      ].filter((signal) => signal !== undefined);
      let response: Response;
      try {
        response = await this.#fetch(url, { ...init, signal: AbortSignal.any(signals) });
      } catch (error) {
        if (options.signal?.aborted) throw options.signal.reason;
        if (attempt >= maxRetries)
          throw new ZeroGenConnectionError(
            error instanceof Error && error.name === "TimeoutError"
              ? `The request timed out after ${options.timeout} ms.`
              : "The request failed to connect.",
            { cause: error },
          );
        await sleep(backoff(attempt), options.signal);
        continue;
      }
      if (response.ok) return response;
      const error = await ZeroGenError.from(response);
      const delay =
        error.retryable && attempt < maxRetries ? retryDelay(response.headers, attempt) : undefined;
      if (delay === undefined) throw error;
      await sleep(delay, options.signal);
    }
  }
}

function env(name: string): string | undefined {
  try {
    const value = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env?.[name];
    return value || undefined;
  } catch {
    return undefined;
  }
}

function backoff(attempt: number): number {
  return Math.min(8_000, 500 * 2 ** attempt) * (0.75 + Math.random() * 0.5);
}

/** How long to wait before retrying: `Retry-After` when the response sets it, or none past a minute. */
function retryDelay(headers: Headers, attempt: number): number | undefined {
  const seconds = Number(headers.get("retry-after") ?? Number.NaN);
  if (!Number.isFinite(seconds) || seconds < 0) return backoff(attempt);
  return seconds * 1000 <= RETRY_AFTER_MAX_MS ? seconds * 1000 : undefined;
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
