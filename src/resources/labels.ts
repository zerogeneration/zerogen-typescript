import type { RequestOptions, ZeroGen } from "../client.js";
import type { PagePromise } from "../pagination.js";
import type {
  AssetBatchChange,
  AssetBatchRequest,
  CreateLabelRequest,
  Label,
  LabelListQuery,
  UpdateLabelRequest,
} from "../types.js";

export class Labels {
  readonly #client: ZeroGen;

  constructor(client: ZeroGen) {
    this.#client = client;
  }

  /** Lists the organization's active labels, and archived ones with `includeArchived`. */
  list(query: LabelListQuery = {}, options?: RequestOptions): PagePromise<Label> {
    return this.#client.list({ method: "GET", path: "/labels", query }, options);
  }

  /** Reads a label. An archived label reads only for owners and admins. */
  get(labelId: string, options?: RequestOptions): Promise<Label> {
    return this.#client.request({ method: "GET", path: path(labelId) }, options);
  }

  /** Creates an organization label; owners and admins only. A test key can't create labels. */
  create(body: CreateLabelRequest, options?: RequestOptions): Promise<Label> {
    return this.#client.request({ method: "POST", path: "/labels", body }, options);
  }

  /**
   * Changes a label's name, description or color, keeping the fields you leave
   * out; owners and admins only.
   */
  update(labelId: string, body: UpdateLabelRequest, options?: RequestOptions): Promise<Label> {
    return this.#client.request({ method: "PATCH", path: path(labelId), body }, options);
  }

  /** Archives a label; its assets keep it. Owners and admins only. */
  archive(labelId: string, options?: RequestOptions): Promise<Label> {
    return this.#client.request({ method: "POST", path: `${path(labelId)}/archive` }, options);
  }

  /** Restores an archived label, with its assets. Owners and admins only. */
  restore(labelId: string, options?: RequestOptions): Promise<Label> {
    return this.#client.request({ method: "POST", path: `${path(labelId)}/restore` }, options);
  }

  /**
   * Adds the label to up to 100 assets, in any of the organization's projects,
   * all or none. Assets that already had it are skipped.
   */
  addAssets(
    labelId: string,
    body: AssetBatchRequest,
    options?: RequestOptions,
  ): Promise<AssetBatchChange> {
    return this.#client.request({ method: "POST", path: `${path(labelId)}/assets`, body }, options);
  }

  /**
   * Removes the label from up to 100 assets, in any of the organization's
   * projects, all or none. The label stays.
   */
  removeAssets(
    labelId: string,
    body: AssetBatchRequest,
    options?: RequestOptions,
  ): Promise<AssetBatchChange> {
    return this.#client.request(
      { method: "POST", path: `${path(labelId)}/assets/remove`, body },
      options,
    );
  }
}

function path(labelId: string): string {
  return `/labels/${encodeURIComponent(labelId)}`;
}
