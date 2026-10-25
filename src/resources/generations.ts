import type { RequestOptions, ZeroGen } from "../client.js";
import type { PagePromise } from "../pagination.js";
import type { CreateGenerationRequest, Generation, GenerationListQuery, Quote } from "../types.js";

/** The most the API holds a response for a generation to end. */
const MAX_WAIT_SECONDS = 60;
const ENDED: ReadonlySet<Generation["status"]> = new Set([
  "succeeded",
  "partial",
  "failed",
  "cancelled",
]);

export interface WaitOptions extends RequestOptions {
  /**
   * Seconds the API may hold the response until the generation ends, up to
   * 60. Without it, the response returns at once.
   */
  wait?: number;
}

/** Whether a generation has ended: succeeded, partial, failed or cancelled. */
export function hasEnded(generation: Pick<Generation, "status">): boolean {
  return ENDED.has(generation.status);
}

export class Generations {
  readonly #client: ZeroGen;

  constructor(client: ZeroGen) {
    this.#client = client;
  }

  /** Prices a request without starting it. */
  quote(body: CreateGenerationRequest, options?: RequestOptions): Promise<Quote> {
    return this.#client.request({ method: "POST", path: "/generations/quote", body }, options);
  }

  /** Starts a generation. */
  create(body: CreateGenerationRequest, options: WaitOptions = {}): Promise<Generation> {
    const { wait, ...rest } = options;
    return this.#client.request({ method: "POST", path: "/generations", body, wait }, rest);
  }

  /**
   * Starts a generation and resolves when it ends. Check its `status`: a
   * generation that failed resolves too. Abort with `signal` to stop waiting;
   * the generation keeps running.
   */
  async createAndWait(
    body: CreateGenerationRequest,
    options: RequestOptions = {},
  ): Promise<Generation> {
    const generation = await this.create(body, { ...options, wait: MAX_WAIT_SECONDS });
    if (hasEnded(generation)) return generation;
    const { idempotencyKey: _, ...rest } = options;
    return this.waitFor(generation.id, rest);
  }

  /** Reads a generation. */
  get(id: string, options: WaitOptions = {}): Promise<Generation> {
    const { wait, ...rest } = options;
    return this.#client.request(
      { method: "GET", path: `/generations/${encodeURIComponent(id)}`, wait },
      rest,
    );
  }

  /**
   * Resolves when a generation ends. Abort with `signal` to stop waiting; the
   * generation keeps running.
   */
  async waitFor(id: string, options: RequestOptions = {}): Promise<Generation> {
    for (;;) {
      const generation = await this.get(id, { ...options, wait: MAX_WAIT_SECONDS });
      if (hasEnded(generation)) return generation;
    }
  }

  /** Lists the generations of the API key's owner, newest first. */
  list(query: GenerationListQuery = {}, options?: RequestOptions): PagePromise<Generation> {
    return this.#client.list({ method: "GET", path: "/generations", query }, options);
  }

  /** Stops a generation's unfinished outputs. Outputs that already finished are kept and charged. */
  cancel(id: string, options?: RequestOptions): Promise<Generation> {
    return this.#client.request(
      { method: "POST", path: `/generations/${encodeURIComponent(id)}/cancel` },
      options,
    );
  }
}
