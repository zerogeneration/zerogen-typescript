import type { RequestOptions, ZeroGen } from "../client.js";
import type { PagePromise } from "../pagination.js";
import type { CreateRunRequest, Quote, Run, RunListQuery } from "../types.js";

/** The most the API holds a response for a run to end. */
const MAX_WAIT_SECONDS = 60;
const ENDED: ReadonlySet<Run["status"]> = new Set(["succeeded", "partial", "failed", "cancelled"]);

export interface WaitOptions extends RequestOptions {
  /**
   * Seconds the API may hold the response until the run ends, up to 60.
   * Without it, the response returns at once.
   */
  wait?: number;
}

/** Whether a run has ended: succeeded, partial, failed or cancelled. */
export function hasEnded(run: Pick<Run, "status">): boolean {
  return ENDED.has(run.status);
}

export class Runs {
  readonly #client: ZeroGen;

  constructor(client: ZeroGen) {
    this.#client = client;
  }

  /** Prices a request without starting it: the most `create` would reserve. */
  quote(body: CreateRunRequest, options?: RequestOptions): Promise<Quote> {
    return this.#client.request({ method: "POST", path: "/runs/quote", body }, options);
  }

  /** Starts a run. */
  create(body: CreateRunRequest, options: WaitOptions = {}): Promise<Run> {
    const { wait, ...rest } = options;
    return this.#client.request({ method: "POST", path: "/runs", body, wait }, rest);
  }

  /**
   * Starts a run and resolves when it ends. Check its `status`: a run that
   * failed resolves too. Abort with `signal` to stop waiting; the run keeps
   * running.
   */
  async createAndWait(body: CreateRunRequest, options: RequestOptions = {}): Promise<Run> {
    const run = await this.create(body, { ...options, wait: MAX_WAIT_SECONDS });
    if (hasEnded(run)) return run;
    const { idempotencyKey: _, ...rest } = options;
    return this.waitFor(run.id, rest);
  }

  /** Reads a run, with each output's status, asset and error. */
  get(id: string, options: WaitOptions = {}): Promise<Run> {
    const { wait, ...rest } = options;
    return this.#client.request(
      { method: "GET", path: `/runs/${encodeURIComponent(id)}`, wait },
      rest,
    );
  }

  /** Resolves when a run ends. Abort with `signal` to stop waiting; the run keeps running. */
  async waitFor(id: string, options: RequestOptions = {}): Promise<Run> {
    for (;;) {
      const run = await this.get(id, { ...options, wait: MAX_WAIT_SECONDS });
      if (hasEnded(run)) return run;
    }
  }

  /** Lists the runs of the API key's owner, newest first. */
  list(query: RunListQuery = {}, options?: RequestOptions): PagePromise<Run> {
    return this.#client.list({ method: "GET", path: "/runs", query }, options);
  }

  /** Stops a run's unfinished outputs. Outputs that already finished are kept and charged. */
  cancel(id: string, options?: RequestOptions): Promise<Run> {
    return this.#client.request(
      { method: "POST", path: `/runs/${encodeURIComponent(id)}/cancel` },
      options,
    );
  }
}
