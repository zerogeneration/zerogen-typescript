import type { RequestOptions, ZeroGen } from "./client.js";
import { ZeroGenError } from "./errors.js";
import type { AssetDownload } from "./types.js";

/** An asset's file as storage starts sending it. */
export type AssetFile = AssetDownload & {
  /** Storage's response: stream the file from `body`, or read it whole with `blob()`. */
  response: Response;
};

/**
 * @internal Fetches a file from the signed URL `link` reads, without the API
 * key or the caller's headers, and reads a new link once if storage refuses
 * an expired one.
 */
export async function downloadFile(
  client: ZeroGen,
  link: () => Promise<AssetDownload>,
  options: RequestOptions,
): Promise<AssetFile> {
  const { signal, timeout, maxRetries } = options;
  for (let attempt = 0; ; attempt++) {
    const download = await link();
    try {
      const response = await client.send(
        download.url,
        { method: "GET" },
        { signal, maxRetries, timeout: timeout ?? null, storage: true },
      );
      return { ...download, response };
    } catch (error) {
      if (attempt > 0 || !(error instanceof ZeroGenError && error.status === 403)) throw error;
    }
  }
}
