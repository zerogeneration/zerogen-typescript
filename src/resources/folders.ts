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

  /** Creates a folder at the project root or under `parentId`. A test key can't create folders. */
  create(projectId: string, body: CreateFolderRequest, options?: RequestOptions): Promise<Folder> {
    return this.#client.request({ method: "POST", path: path(projectId), body }, options);
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
