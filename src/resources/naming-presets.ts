import type { RequestOptions, ZeroGen } from "../client.js";
import type { PagePromise } from "../pagination.js";
import type { CreateNamingPresetRequest, NamingPreset, NamingPresetListQuery } from "../types.js";

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
      { method: "GET", path: "/naming-presets", query: { ...query, projectId } },
      options,
    );
  }

  /**
   * Saves a naming preset for everyone in `projectId`; owners and admins
   * only. Its fields run in order, joined by `delimiter`. A test key can't
   * create presets.
   */
  create(body: CreateNamingPresetRequest, options?: RequestOptions): Promise<NamingPreset> {
    return this.#client.request({ method: "POST", path: "/naming-presets", body }, options);
  }
}
