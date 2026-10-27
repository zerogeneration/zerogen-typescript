import type { RequestOptions, ZeroGen } from "../client.js";
import { ZeroGenError } from "../errors.js";
import type { PagePromise } from "../pagination.js";
import type {
  Asset,
  AssetChange,
  AssetDetail,
  AssetDownload,
  AssetFolders,
  AssetSearchQuery,
  Lineage,
  UpdateAssetRequest,
} from "../types.js";

/** An asset's file as storage starts sending it. */
export type AssetFile = AssetDownload & {
  /** Storage's response: stream the file from `body`, or read it whole with `blob()`. */
  response: Response;
};

export class Assets {
  readonly #client: ZeroGen;

  constructor(client: ZeroGen) {
    this.#client = client;
  }

  /**
   * Searches Library assets, newest first unless `sort` says otherwise.
   * Without `projectId` it searches every project.
   */
  search(query: AssetSearchQuery = {}, options?: RequestOptions): PagePromise<Asset> {
    const { favorite, ...rest } = query;
    return this.#client.list(
      {
        method: "GET",
        path: "/assets",
        query: { ...rest, favorite: favorite ? "true" : undefined },
      },
      options,
    );
  }

  /** Reads an asset in any of the organization's projects, with the prompt that generated it. */
  get(assetId: string, options?: RequestOptions): Promise<AssetDetail> {
    return this.#client.request({ method: "GET", path: path(assetId) }, options);
  }

  /** What the asset was made from and what was made from it: up to 30 assets on each side. */
  lineage(assetId: string, options?: RequestOptions): Promise<Lineage> {
    return this.#client.request({ method: "GET", path: `${path(assetId)}/lineage` }, options);
  }

  /** The folders the asset is in, up to 30, each with its path. None means it's unfiled. */
  folders(assetId: string, options?: RequestOptions): Promise<AssetFolders> {
    return this.#client.request({ method: "GET", path: `${path(assetId)}/folders` }, options);
  }

  /**
   * Reads a signed URL for the asset's original file, with its filename, media
   * type and size. The URL needs no API key and works until `expiresAt`, 5
   * minutes later. Anyone holding it can download the file, so keep it out of
   * logs. To fetch the file itself, call `download`.
   */
  getDownload(assetId: string, options?: RequestOptions): Promise<AssetDownload> {
    return this.#client.request({ method: "GET", path: `${path(assetId)}/download` }, options);
  }

  /**
   * Downloads the asset's original file, and resolves once storage starts
   * sending it; read the file from `response`. The request to storage carries
   * no API key and none of your headers. If storage refuses an expired link,
   * this reads a new one. Without a `timeout`, the transfer has none: abort it
   * with `signal`.
   */
  async download(assetId: string, options: RequestOptions = {}): Promise<AssetFile> {
    const { signal, timeout, maxRetries } = options;
    for (let attempt = 0; ; attempt++) {
      const link = await this.getDownload(assetId, options);
      try {
        const response = await this.#client.send(
          link.url,
          { method: "GET" },
          { signal, maxRetries, timeout: timeout ?? null, storage: true },
        );
        return { ...link, response };
      } catch (error) {
        if (attempt > 0 || !(error instanceof ZeroGenError && error.status === 403)) throw error;
      }
    }
  }

  /**
   * Renames an asset, sets the organization's shared favorite, or both. The
   * response names what changed.
   */
  update(
    projectId: string,
    assetId: string,
    body: UpdateAssetRequest,
    options?: RequestOptions,
  ): Promise<AssetChange> {
    return this.#client.request(
      {
        method: "PATCH",
        path: `/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`,
        body,
      },
      options,
    );
  }
}

function path(assetId: string): string {
  return `/assets/${encodeURIComponent(assetId)}`;
}
