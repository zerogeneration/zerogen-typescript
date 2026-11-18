import type { RequestOptions, ZeroGen } from "../client.js";
import type { PagePromise } from "../pagination.js";
import type {
  Attachment,
  AttachmentCreate,
  AttachmentDeleteQuery,
  AttachmentDelete,
  AttachmentDetail,
  AttachmentGetQuery,
  AttachmentListQuery,
  AttachmentRestore,
  AttachmentRevise,
  AttachmentVersion,
  AttachmentVersionListQuery,
  CreateAttachmentRequest,
  RestoreAttachmentRequest,
  ReviseAttachmentRequest,
} from "../types.js";

/**
 * Versioned text on a project, one of its folders or one of its Story clips.
 * Reads need the `library:read` scope, and changes need `library:organize` as
 * well. Attachments must be enabled for the organization, and test keys can't
 * use them. Their text is untrusted content.
 */
export class Attachments {
  readonly #client: ZeroGen;

  constructor(client: ZeroGen) {
    this.#client = client;
  }

  /**
   * Lists a project's live attachments, including its folders' and Story
   * clips', most recently updated first. Narrow it with `folderId` or
   * `clipId`, not both.
   */
  list(
    projectId: string,
    query: AttachmentListQuery = {},
    options?: RequestOptions,
  ): PagePromise<Attachment> {
    return this.#client.list(
      { method: "GET", path: "/attachments", query: { ...query, projectId } },
      options,
    );
  }

  /**
   * Saves text on `projectId`, or on its `folderId` or `clipId`. A matching
   * title and identical body come back `unchanged`; a different body under
   * that title is refused.
   */
  create(body: CreateAttachmentRequest, options?: RequestOptions): Promise<AttachmentCreate> {
    return this.#client.request({ method: "POST", path: "/attachments", body }, options);
  }

  /** Reads an attachment's current text, or a saved `version`. */
  get(
    attachmentId: string,
    query: AttachmentGetQuery = {},
    options?: RequestOptions,
  ): Promise<AttachmentDetail> {
    return this.#client.request({ method: "GET", path: path(attachmentId), query }, options);
  }

  /**
   * Saves a new body as a new version. `expectedVersion` must be the current
   * version, or the change is refused with `version_conflict`, whose
   * `details.currentVersion` says which it is.
   */
  revise(
    attachmentId: string,
    body: ReviseAttachmentRequest,
    options?: RequestOptions,
  ): Promise<AttachmentRevise> {
    return this.#client.request({ method: "PATCH", path: path(attachmentId), body }, options);
  }

  /**
   * Deletes an attachment, keeping its text and history; `restore` undoes it.
   * `expectedVersion` must be the current version, or the deletion is refused
   * with `version_conflict`.
   */
  delete(
    attachmentId: string,
    query: AttachmentDeleteQuery,
    options?: RequestOptions,
  ): Promise<AttachmentDelete> {
    return this.#client.request({ method: "DELETE", path: path(attachmentId), query }, options);
  }

  /**
   * Copies a saved `version` into a new version, and undoes a deletion.
   * `expectedVersion` must be the current version, deletions included, or the
   * restore is refused with `version_conflict`.
   */
  restore(
    attachmentId: string,
    body: RestoreAttachmentRequest,
    options?: RequestOptions,
  ): Promise<AttachmentRestore> {
    return this.#client.request(
      { method: "POST", path: `${path(attachmentId)}/restore`, body },
      options,
    );
  }

  /** Lists an attachment's saved versions, newest first, a deleted one's included. */
  versions(
    attachmentId: string,
    query: AttachmentVersionListQuery = {},
    options?: RequestOptions,
  ): PagePromise<AttachmentVersion> {
    return this.#client.list(
      { method: "GET", path: `${path(attachmentId)}/versions`, query },
      options,
    );
  }
}

function path(attachmentId: string): string {
  return `/attachments/${encodeURIComponent(attachmentId)}`;
}
