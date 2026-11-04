import type { RequestOptions, ZeroGen } from "../client.js";
import { ZeroGenError } from "../errors.js";
import type { CreateUploadRequest, DeclareUploadRequest, Upload } from "../types.js";

type ContentType = CreateUploadRequest["contentType"];

/** Files up to this size get a SHA-256 digest, so an identical file in the project is reused. */
const DIGEST_MAX_BYTES = 64 * 1024 * 1024;

const CONTENT_TYPES: Record<string, ContentType> = {
  aac: "audio/aac",
  aif: "audio/aiff",
  aiff: "audio/aiff",
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
};

export type UploadSource = Blob | ArrayBuffer | Uint8Array;

/** An upload whose Library asset is ready to use as a run input. */
export type ReadyUpload = Upload & {
  status: "ready";
  assetId: string;
  /**
   * Whether ZeroGen recorded the `declaration`. It's false without one, and
   * when the project already had an identical file that can't take it: one
   * with a declaration, one a run made, one someone else uploaded, or one the
   * declaration's `sources` include or were made from. That asset keeps its
   * own lineage. When the identical file takes it, `runId` stays null, and
   * the run is the asset's `runId`.
   */
  declarationRecorded: boolean;
};

export interface UploadFileOptions extends Omit<RequestOptions, "idempotencyKey"> {
  /** Defaults to the name of a `File`. */
  filename?: string;
  /** Defaults to the `Blob`'s type, then to the type the filename's extension implies. */
  contentType?: ContentType;
  /** The project to upload into; the organization's default project when omitted. */
  projectId?: string;
  /** A folder in that project to add the asset to. */
  folderId?: string;
  /**
   * The file's SHA-256 digest in lowercase hex, which reuses an identical
   * file already in the project. Computed for files up to 64 MiB when omitted.
   */
  sha256?: string;
  /**
   * How the file was made outside ZeroGen, recorded as the asset's run
   * without verification: the `tool`, and optionally its `sources`, `prompt`,
   * `workflow`, `externalRef` and `occurredAt`. Declaring `sources` also
   * needs the `library:read` scope.
   */
  declaration?: DeclareUploadRequest;
  /** A naming preset and its values to name the asset by. Needs a `declaration`. */
  naming?: CreateUploadRequest["naming"];
}

export class Uploads {
  readonly #client: ZeroGen;

  constructor(client: ZeroGen) {
    this.#client = client;
  }

  /**
   * Uploads a file into the Library and resolves when it's ready to use as a
   * run input, with its `assetId`. In Node.js, read a file with
   * `fs.openAsBlob(path)`. With a `declaration`, an identical file already in
   * the project is declared instead, if it can be: check `declarationRecorded`.
   */
  async upload(file: UploadSource, options: UploadFileOptions = {}): Promise<ReadyUpload> {
    const {
      filename: name,
      contentType: type,
      projectId,
      folderId,
      sha256,
      declaration,
      naming,
      ...rest
    } = options;
    const blob = file instanceof Blob ? file : new Blob([file as BlobPart]);
    const filename =
      name ?? ("name" in blob && typeof blob.name === "string" ? blob.name : undefined);
    if (!filename) throw new TypeError("Pass filename to upload a file that has no name.");
    const contentType = type || (blob.type as ContentType) || CONTENT_TYPES[extension(filename)];
    if (!contentType)
      throw new TypeError(`Pass contentType: ${filename} has no type ZeroGen recognizes.`);
    let upload = await this.create(
      {
        filename,
        contentType,
        sizeBytes: blob.size,
        sha256: sha256 ?? (blob.size <= DIGEST_MAX_BYTES ? await digest(blob) : undefined),
        projectId,
        folderId,
        ...declaration,
        naming,
      },
      rest,
    );
    if (upload.status !== "ready") {
      if (!upload.upload) throw new Error(`Upload ${upload.id} has no target to send the file to.`);
      await this.#client.send(
        upload.upload.url,
        { method: upload.upload.method, headers: upload.upload.headers, body: blob },
        { ...rest, timeout: rest.timeout ?? null, storage: true },
      );
      upload = await this.complete(upload.id, rest);
    }
    if (upload.status !== "ready" || upload.assetId === null)
      throw new Error(`Upload ${upload.id} isn't ready.`);
    const ready = { ...upload, status: upload.status, assetId: upload.assetId };
    if (!declaration || ready.runId) return { ...ready, declarationRecorded: Boolean(declaration) };
    // No run means the project had an identical file, and the declaration went unrecorded.
    try {
      await this.#client.assets.declare(ready.assetId, declaration, rest);
      return { ...ready, declarationRecorded: true };
    } catch (error) {
      if (undeclarable(error)) return { ...ready, declarationRecorded: false };
      throw error;
    }
  }

  /** Starts an upload. `PUT` the file's bytes to the returned target, then complete it. */
  create(body: CreateUploadRequest, options?: RequestOptions): Promise<Upload> {
    return this.#client.request({ method: "POST", path: "/uploads", body }, options);
  }

  /** Reads one of your uploads. */
  get(id: string, options?: RequestOptions): Promise<Upload> {
    return this.#client.request(
      { method: "GET", path: `/uploads/${encodeURIComponent(id)}` },
      options,
    );
  }

  /** Checks the uploaded bytes and makes them a Library asset. Completing again returns the same asset. */
  complete(id: string, options?: RequestOptions): Promise<Upload> {
    return this.#client.request(
      { method: "POST", path: `/uploads/${encodeURIComponent(id)}/complete` },
      options,
    );
  }
}

/** Whether declaring failed because the identical file can't take the declaration. */
function undeclarable(error: unknown): boolean {
  if (!(error instanceof ZeroGenError)) return false;
  return (
    error.code === "invalid_state" ||
    error.code === "permission_denied" ||
    // A source is the asset itself or made from it, as when a graph saves its input unchanged.
    (error.code === "validation_failed" && error.param === "sources")
  );
}

function extension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

async function digest(blob: Blob): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
