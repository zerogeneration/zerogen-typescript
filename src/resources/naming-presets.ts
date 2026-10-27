import type { RequestOptions, ZeroGen } from "../client.js";
import type { PagePromise } from "../pagination.js";
import type { NamingPreset, NamingPresetListQuery } from "../types.js";

export class NamingPresets {
  readonly #client: ZeroGen;

  constructor(client: ZeroGen) {
    this.#client = client;
  }

  /** Lists a project's shared naming presets. Pass one's `id` and field values as a run's `naming`. */
  list(
    projectId: string,
    query: NamingPresetListQuery = {},
    options?: RequestOptions,
  ): PagePromise<NamingPreset> {
    return this.#client.list(
      { method: "GET", path: `/projects/${encodeURIComponent(projectId)}/naming-presets`, query },
      options,
    );
  }
}
