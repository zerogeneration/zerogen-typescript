import type { RequestOptions, ZeroGen } from "../client.js";
import type { PagePromise } from "../pagination.js";
import type {
  CreateFolderRequest,
  Folder,
  FolderAssetsChange,
  FolderAssetsRequest,
  FolderListQuery,
  MoveAssetsRequest,
  UpdateFolderRequest,
} from "../types.js";

/**
 * Each level of a path is its own create, with its own idempotency key, so
 * `ensurePath` takes none.
 */
export interface EnsurePathOptions extends Omit<RequestOptions, "idempotencyKey"> {
  /** The folder the path starts under; the project root by default. */
  parentId?: string | null;
}

export class Folders {
  readonly #client: ZeroGen;

  constructor(client: ZeroGen) {
    this.#client = client;
  }

  /** Lists a project's folders, each with its parent, to assemble the folder tree. */
  list(
    projectId: string,
    query: FolderListQuery = {},
    options?: RequestOptions,
  ): PagePromise<Folder> {
    return this.#client.list({ method: "GET", path: path(projectId), query }, options);
  }

  /**
   * Creates a folder at the project root or under `parentId`. With
   * `reuseExisting`, a folder of that name already under the parent is
   * returned instead. A test key can't create folders.
   */
  create(projectId: string, body: CreateFolderRequest, options?: RequestOptions): Promise<Folder> {
    return this.#client.request({ method: "POST", path: path(projectId), body }, options);
  }

  /**
   * Returns the folder at `folderPath`, such as `"SH010/anim"`, creating each
   * folder on the way that isn't there yet. Each level is a create with
   * `reuseExisting`, which returns the folder of that name already under its
   * parent, so clients filing into the same path at once share its folders.
   * A string splits on `/`; pass an array when a name contains `/`. The path
   * starts under `parentId`, or at the project root.
   */
  async ensurePath(
    projectId: string,
    folderPath: string | readonly string[],
    options: EnsurePathOptions = {},
  ): Promise<Folder> {
    // A shared RequestOptions can still carry a key at runtime; each level needs its own.
    const {
      parentId = null,
      idempotencyKey: _,
      ...request
    } = options as RequestOptions & EnsurePathOptions;
    const names =
      typeof folderPath === "string"
        ? folderPath.split("/").filter((name) => name.trim())
        : [...folderPath];
    if (names.length === 0) throw new TypeError("A folder path needs at least one folder name.");
    let folder: Folder | undefined;
    for (const name of names) {
      folder = await this.create(
        projectId,
        { name, parentId: folder?.id ?? parentId, reuseExisting: true },
        request,
      );
    }
    return folder as Folder;
  }

  /**
   * Renames a folder, moves it under another parent (or to the project root
   * with `parentId: null`), or both.
   */
  update(
    projectId: string,
    folderId: string,
    body: UpdateFolderRequest,
    options?: RequestOptions,
  ): Promise<Folder> {
    return this.#client.request(
      { method: "PATCH", path: path(projectId, folderId), body },
      options,
    );
  }

  /** Adds up to 100 assets to the folder, keeping their other folders. */
  addAssets(
    projectId: string,
    folderId: string,
    body: FolderAssetsRequest,
    options?: RequestOptions,
  ): Promise<FolderAssetsChange> {
    return this.#client.request(
      { method: "POST", path: `${path(projectId, folderId)}/assets`, body },
      options,
    );
  }

  /**
   * Moves up to 100 assets out of `fromFolderId` and into this folder; their
   * other folders keep them.
   */
  moveAssets(
    projectId: string,
    folderId: string,
    body: MoveAssetsRequest,
    options?: RequestOptions,
  ): Promise<FolderAssetsChange> {
    return this.#client.request(
      { method: "POST", path: `${path(projectId, folderId)}/assets/move`, body },
      options,
    );
  }

  /** Takes up to 100 assets out of the folder. They stay in the Library and their other folders. */
  removeAssets(
    projectId: string,
    folderId: string,
    body: FolderAssetsRequest,
    options?: RequestOptions,
  ): Promise<FolderAssetsChange> {
    return this.#client.request(
      { method: "POST", path: `${path(projectId, folderId)}/assets/remove`, body },
      options,
    );
  }
}

function path(projectId: string, folderId?: string): string {
  const folders = `/projects/${encodeURIComponent(projectId)}/folders`;
  return folderId === undefined ? folders : `${folders}/${encodeURIComponent(folderId)}`;
}
