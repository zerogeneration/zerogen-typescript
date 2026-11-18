import type { RequestOptions, ZeroGen } from "../client.js";
import { type AssetFile, downloadFile } from "../download.js";
import type { PagePromise } from "../pagination.js";
import type { AssetDownload, Quote, Run, RunCreateParams, RunListQuery } from "../types.js";

/** The most the API holds a response for a run to end. */
export const MAX_WAIT_SECONDS = 60;

export interface WaitOptions extends RequestOptions {
  /**
   * Seconds the API may hold the response until the run ends, up to 60.
   * Without it, the response returns at once.
   */
  wait?: number;
}

/**
 * Whether a run has ended, whatever its status: the API sets `endedAt` exactly
 * when it has. Check each output then, since a failed or cancelled run can
 * still hold succeeded ones.
 */
export function hasEnded(run: Pick<Run, "endedAt">): boolean {
  return run.endedAt != null;
}

export class Runs {
  readonly #client: ZeroGen;

  constructor(client: ZeroGen) {
    this.#client = client;
  }

  /**
   * Prices a request without starting it: the most `create` would reserve,
   * and the `inputs` it would use. Send those `inputs` with the create, so it
   * uses the assets the quote imported for URL inputs. A quote needs the
   * `models:read` scope; URL inputs also need `uploads:create`, and
   * `labelIds` need `library:organize`.
   */
  quote(body: RunCreateParams, options?: RequestOptions): Promise<Quote> {
    return this.#client.request({ method: "POST", path: "/runs/quote", body }, options);
  }

  /** Starts a run. */
  create(body: RunCreateParams, options: WaitOptions = {}): Promise<Run> {
    const { wait, ...rest } = options;
    return this.#client.request({ method: "POST", path: "/runs", body, wait }, rest);
  }

  /**
   * Starts a run and resolves when it ends. Check its `status` and each
   * output's: a run that failed resolves too. Abort with `signal` to stop
   * waiting; the run keeps running.
   */
  async createAndWait(body: RunCreateParams, options: RequestOptions = {}): Promise<Run> {
    const run = await this.create(body, { ...options, wait: MAX_WAIT_SECONDS });
    if (hasEnded(run)) return run;
    const { idempotencyKey: _, ...rest } = options;
    return this.waitFor(run.id, rest);
  }

  /** Reads any run in the organization, with each output's status, asset and error. */
  get(id: string, options: WaitOptions = {}): Promise<Run> {
    const { wait, ...rest } = options;
    return this.#client.request({ method: "GET", path: path(id), wait }, rest);
  }

  /**
   * Resolves when a run ends, as `endedAt` says, whatever its status. Abort
   * with `signal` to stop waiting; the run keeps running.
   */
  async waitFor(id: string, options: RequestOptions = {}): Promise<Run> {
    for (;;) {
      const run = await this.get(id, { ...options, wait: MAX_WAIT_SECONDS });
      if (hasEnded(run)) return run;
    }
  }

  /**
   * Lists the organization's runs, whoever started them, newest first. Filter
   * by `projectId`, `folderId`, `createdBy`, `status`, and `createdAfter` and
   * `createdBefore`.
   */
  list(query: RunListQuery = {}, options?: RequestOptions): PagePromise<Run> {
    const { createdAfter, createdBefore, ...rest } = query;
    return this.#client.list(
      {
        method: "GET",
        path: "/runs",
        query: { ...rest, createdAfter: time(createdAfter), createdBefore: time(createdBefore) },
      },
      options,
    );
  }

  /**
   * Stops a run's unfinished outputs. Outputs that already finished are kept
   * and charged. An output the provider already started can't be stopped: the
   * run stays `running`, and that output is delivered and charged when it
   * finishes. You can cancel your own runs; owners and admins can cancel any.
   */
  cancel(id: string, options?: RequestOptions): Promise<Run> {
    return this.#client.request({ method: "POST", path: `${path(id)}/cancel` }, options);
  }

  /**
   * Reads a signed URL for one succeeded output's original file, by the run's
   * ID and the output's asset ID, with `runs:read` alone. The URL needs no API
   * key and works until `expiresAt`, 5 minutes later. Anyone holding it can
   * download the file, so keep it out of logs.
   */
  getOutputDownload(
    runId: string,
    assetId: string,
    options?: RequestOptions,
  ): Promise<AssetDownload> {
    return this.#client.request(
      { method: "GET", path: `${path(runId)}/outputs/${encodeURIComponent(assetId)}/download` },
      options,
    );
  }

  /**
   * Downloads one succeeded output's original file, with `runs:read` alone,
   * and resolves once storage starts sending it; read the file from
   * `response`. The request to storage carries no API key and none of your
   * headers. If storage refuses an expired link, this reads a new one.
   * Without a `timeout`, the transfer has none: abort it with `signal`.
   */
  downloadOutput(runId: string, assetId: string, options: RequestOptions = {}): Promise<AssetFile> {
    return downloadFile(
      this.#client,
      () => this.getOutputDownload(runId, assetId, options),
      options,
    );
  }
}

function path(id: string): string {
  return `/runs/${encodeURIComponent(id)}`;
}

function time(value: Date | string | undefined): string | undefined {
  return value instanceof Date ? value.toISOString() : value;
}
