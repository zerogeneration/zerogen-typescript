import type { RequestOptions, ZeroGen } from "../client.js";
import type { PagePromise } from "../pagination.js";
import type { Lut, LutListQuery } from "../types.js";

export class Luts {
  readonly #client: ZeroGen;

  constructor(client: ZeroGen) {
    this.#client = client;
  }

  /**
   * Lists the organization's LUTs, newest first, to name as `lut.lutId` in a
   * transform's recipe. People add and remove LUTs in ZeroGen. A test key
   * sees none.
   */
  list(query: LutListQuery = {}, options?: RequestOptions): PagePromise<Lut> {
    return this.#client.list({ method: "GET", path: "/luts", query }, options);
  }
}
