import type { RequestOptions, ZeroGen } from "../client.js";
import type { PagePromise } from "../pagination.js";
import type {
  CreateLabelRequest,
  Label,
  LabelAssetsChange,
  LabelAssetsRequest,
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

  /** Creates an organization label; owners and admins only. A test key can't create labels. */
  create(body: CreateLabelRequest, options?: RequestOptions): Promise<Label> {
    return this.#client.request({ method: "POST", path: "/labels", body }, options);
  }

  /** Replaces a label's name, description and color, so send all three; owners and admins only. */
  update(labelId: string, body: UpdateLabelRequest, options?: RequestOptions): Promise<Label> {
    return this.#client.request({ method: "PUT", path: path(labelId), body }, options);
  }

  /** Archives a label; its assets keep it. Owners and admins only. */
  archive(labelId: string, options?: RequestOptions): Promise<Label> {
    return this.#client.request({ method: "POST", path: `${path(labelId)}/archive` }, options);
  }

  /** Restores an archived label, with its assets. Owners and admins only. */
  restore(labelId: string, options?: RequestOptions): Promise<Label> {
    return this.#client.request({ method: "POST", path: `${path(labelId)}/restore` }, options);
  }

  /** Adds the label to up to 50 assets in the project, all or none. */
  addAssets(
    projectId: string,
    labelId: string,
    body: LabelAssetsRequest,
    options?: RequestOptions,
  ): Promise<LabelAssetsChange> {
    return this.#client.request(
      { method: "POST", path: assetsPath(projectId, labelId), body },
      options,
    );
  }

  /** Removes the label from up to 50 assets in the project, all or none. The label stays. */
  removeAssets(
    projectId: string,
    labelId: string,
    body: LabelAssetsRequest,
    options?: RequestOptions,
  ): Promise<LabelAssetsChange> {
    return this.#client.request(
      { method: "POST", path: `${assetsPath(projectId, labelId)}/remove`, body },
      options,
    );
  }
}

function path(labelId: string): string {
  return `/labels/${encodeURIComponent(labelId)}`;
}

function assetsPath(projectId: string, labelId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/labels/${encodeURIComponent(labelId)}/assets`;
}
