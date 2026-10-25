import type { RequestOptions, ZeroGen } from "../client.js";
import type { PagePromise } from "../pagination.js";
import type { Model, ModelDetail, ModelListQuery } from "../types.js";

export class Models {
  readonly #client: ZeroGen;

  constructor(client: ZeroGen) {
    this.#client = client;
  }

  /** Lists the models the organization can run. */
  list(query: ModelListQuery = {}, options?: RequestOptions): PagePromise<Model> {
    return this.#client.list({ method: "GET", path: "/models", query }, options);
  }

  /**
   * Reads a model and its request schema, by an ID such as
   * `openai/gpt-image-2/generate`.
   */
  get(id: string, options?: RequestOptions): Promise<ModelDetail> {
    const path = id.split("/").map(encodeURIComponent).join("/");
    return this.#client.request({ method: "GET", path: `/models/${path}` }, options);
  }
}
