import type { RequestOptions, ZeroGen } from "../client.js";
import { type AssetFile, downloadFile } from "../download.js";
import type { PagePromise } from "../pagination.js";
import type {
  Asset,
  AssetDeclaration,
  AssetDelete,
  AssetDetail,
  AssetDownload,
  AssetFolder,
  AssetFolderListQuery,
  AssetSearchQuery,
  DeclareUploadRequest,
  LineageAsset,
  LineageListQuery,
  TransformAssetRequest,
  TransformRun,
  UpdateAssetRequest,
} from "../types.js";
import { hasEnded, MAX_WAIT_SECONDS, type WaitOptions } from "./runs.js";

export interface AssetGetOptions extends RequestOptions {
  /** Also read the `workflow` declared with an upload; untrusted content. */
  includeWorkflow?: boolean;
}

export class Assets {
  readonly #client: ZeroGen;

  constructor(client: ZeroGen) {
    this.#client = client;
  }

  /**
   * Searches Library assets, newest first unless `sort` says otherwise, each
   * with its `preview`. Without `projectId` it searches every project.
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

  /**
   * Reads an asset in any of the organization's projects, with the prompt that
   * generated it, its `preview`, and what was `declared` about an upload. With
   * `includeWorkflow`, it also reads the upload's declared `workflow`.
   */
  get(assetId: string, options: AssetGetOptions = {}): Promise<AssetDetail> {
    const { includeWorkflow, ...rest } = options;
    return this.#client.request(
      {
        method: "GET",
        path: path(assetId),
        query: { includeWorkflow: includeWorkflow ? true : undefined },
      },
      rest,
    );
  }

  /**
   * Renames an asset, sets the organization's shared favorite, or both,
   * together: a refused request changes neither. Resolves with the asset as
   * `get` reads it. It needs the `library:organize` and `library:read` scopes.
   */
  update(
    assetId: string,
    body: UpdateAssetRequest,
    options?: RequestOptions,
  ): Promise<AssetDetail> {
    return this.#client.request({ method: "PATCH", path: path(assetId), body }, options);
  }

  /**
   * Moves an asset to Recently deleted: it leaves search and its folders,
   * can't be a run input, and reads as `not_found` until `restore` puts it
   * back. Deleting it again returns the same deletion. It needs the
   * `library:delete` scope, which has to be granted explicitly. A test key
   * can't delete assets.
   */
  delete(assetId: string, options?: RequestOptions): Promise<AssetDelete> {
    return this.#client.request({ method: "DELETE", path: path(assetId) }, options);
  }

  /**
   * Returns an asset from Recently deleted to its folders, and resolves with
   * it as `get` reads it. An active asset comes back unchanged. It needs the
   * `library:organize` and `library:read` scopes. A test key can't restore
   * assets.
   */
  restore(assetId: string, options?: RequestOptions): Promise<AssetDetail> {
    return this.#client.request({ method: "POST", path: `${path(assetId)}/restore` }, options);
  }

  /**
   * Declares how one of your uploads was made outside ZeroGen: the `tool`,
   * and optionally its `sources`, `prompt`, `workflow`, `externalRef` and
   * `occurredAt`. ZeroGen records the claim as the run that made the asset,
   * without verifying it, charging for it, or starting anything. An upload
   * takes one declaration, from the user who uploaded it or an owner or
   * admin. Declaring `sources` also needs the `library:read` scope.
   */
  declare(
    assetId: string,
    body: DeclareUploadRequest,
    options?: RequestOptions,
  ): Promise<AssetDeclaration> {
    return this.#client.request(
      { method: "POST", path: `${path(assetId)}/declaration`, body },
      options,
    );
  }

  /**
   * Lists what the asset was made from, in any project, and what those were
   * made from, nearest first. Each source's `edges` join it to the asset or to
   * sources listed before it.
   */
  sources(
    assetId: string,
    query: LineageListQuery = {},
    options?: RequestOptions,
  ): PagePromise<LineageAsset> {
    return this.#client.list({ method: "GET", path: `${path(assetId)}/sources`, query }, options);
  }

  /**
   * Lists what was made from the asset, in its project, and what was made from
   * those, nearest first. Each use's `edges` join it to the asset or to uses
   * listed before it.
   */
  uses(
    assetId: string,
    query: LineageListQuery = {},
    options?: RequestOptions,
  ): PagePromise<LineageAsset> {
    return this.#client.list({ method: "GET", path: `${path(assetId)}/uses`, query }, options);
  }

  /**
   * Lists the folders the asset is in, each with its path, sorted by path. An
   * empty list means it's unfiled.
   */
  folders(
    assetId: string,
    query: AssetFolderListQuery = {},
    options?: RequestOptions,
  ): PagePromise<AssetFolder> {
    return this.#client.list({ method: "GET", path: `${path(assetId)}/folders`, query }, options);
  }

  /**
   * Starts a transform: a free Derived copy of the asset from a `recipe`, such
   * as a frame of a video, a trimmed clip, a LUT grade or an MP3 of its sound.
   * Resolves with the run that makes it; its output's asset is the copy. Your
   * earlier run of the same recipe returns with `reused` true instead. It
   * needs the `runs:create` and `runs:read` scopes. A test key can't
   * transform assets.
   */
  transform(
    assetId: string,
    body: TransformAssetRequest,
    options: WaitOptions = {},
  ): Promise<TransformRun> {
    const { wait, ...rest } = options;
    return this.#client.request(
      { method: "POST", path: `${path(assetId)}/transform`, body, wait },
      rest,
    );
  }

  /**
   * Starts a transform and resolves when its run ends. Check its `status`: a
   * run that failed resolves too. Abort with `signal` to stop waiting; the
   * run keeps running.
   */
  async transformAndWait(
    assetId: string,
    body: TransformAssetRequest,
    options: RequestOptions = {},
  ): Promise<TransformRun> {
    const run = await this.transform(assetId, body, { ...options, wait: MAX_WAIT_SECONDS });
    if (hasEnded(run)) return run;
    const { idempotencyKey: _, ...rest } = options;
    return { ...(await this.#client.runs.waitFor(run.id, rest)), reused: run.reused };
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
  download(assetId: string, options: RequestOptions = {}): Promise<AssetFile> {
    return downloadFile(this.#client, () => this.getDownload(assetId, options), options);
  }
}

function path(assetId: string): string {
  return `/assets/${encodeURIComponent(assetId)}`;
}
