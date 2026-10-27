# Changelog

## 0.2.1

- Types for asset previews. Each asset from `assets.search` and `assets.get`,
  and each run output's `asset`, has a `preview`: an `AssetPreview` with
  `image96Url`, `image512Url`, `videoUrl` and `expiresAt`, or null until the
  previews are made. The URLs are signed: load them without your API key, and
  read the asset or run again after `expiresAt`. 0.2.0 receives the same
  field, untyped.

## 0.2.0

This release follows the API's rename of generations to runs, and breaks
code written for 0.1.0.

- **Breaking:** `generations` is now `runs`, on `/v1/runs`: `runs.quote`,
  `create`, `createAndWait`, `get`, `waitFor`, `list` and `cancel`. The
  `Generation`, `CreateGenerationRequest` and `GenerationListQuery` types are
  now `Run`, `CreateRunRequest` and `RunListQuery`. `hasEnded` takes a run.
- The Library: `projects.list`; `assets.search`, `get`, `lineage`, `folders`
  and `update`; `folders`, `labels`, `namingPresets` and `skills`. They need
  the `library:read` and `library:organize` scopes.
- `assets.download` fetches an asset's original file from a signed storage
  URL, without sending your API key there, and reads a new link if storage
  refuses an expired one. `assets.getDownload` returns the signed URL itself.
- Errors from storage, during an upload or a download, no longer quote the
  storage response, which can echo the request's signature.
- Types from the current API, including the `keyframe` input role,
  `timeSeconds`, the `speech` capability and `keyframes-to-video` models.

## 0.1.0

The first release: a typed client for every `/v1` endpoint, with retries,
automatic idempotency keys, `createAndWait`, paginated lists, and file uploads.
