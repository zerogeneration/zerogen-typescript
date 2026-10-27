import type { RequestOptions, ZeroGen } from "../client.js";
import type { PagePromise } from "../pagination.js";
import type { Project } from "../types.js";

export class Projects {
  readonly #client: ZeroGen;

  constructor(client: ZeroGen) {
    this.#client = client;
  }

  /** Lists the organization's projects, in one page. A test key lists only its API sandbox. */
  list(options?: RequestOptions): PagePromise<Project> {
    return this.#client.list({ method: "GET", path: "/projects" }, options);
  }
}
