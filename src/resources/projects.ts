import type { RequestOptions, ZeroGen } from "../client.js";
import type { PagePromise } from "../pagination.js";
import type { Project, ProjectListQuery } from "../types.js";

export class Projects {
  readonly #client: ZeroGen;

  constructor(client: ZeroGen) {
    this.#client = client;
  }

  /**
   * Lists the organization's projects, the default project first, then newest
   * first. A test key lists only its API sandbox.
   */
  list(query: ProjectListQuery = {}, options?: RequestOptions): PagePromise<Project> {
    return this.#client.list({ method: "GET", path: "/projects", query }, options);
  }

  /** Reads a project. A test key reads only its API sandbox. */
  get(projectId: string, options?: RequestOptions): Promise<Project> {
    return this.#client.request(
      { method: "GET", path: `/projects/${encodeURIComponent(projectId)}` },
      options,
    );
  }
}
