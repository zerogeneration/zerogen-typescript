# Changelog

## 0.3.0

This release follows the current `/v1`. Code written for 0.2.1 keeps working.

- Declared provenance for files made outside ZeroGen.
  `uploads.upload(file, { declaration, naming })` sends the tool, `sources`,
  `prompt`, `workflow`, `externalRef` and `occurredAt`. ZeroGen records them,
  unverified and free, as the run that made the asset. If the project already
  has an identical file, `upload` declares it instead when it can, and
  `declarationRecorded` says whether it did.
- `assets.declare(assetId, body)` declares a file you uploaded earlier.
- `assets.get(assetId, { includeWorkflow: true })` reads a declared workflow.
- Types for `declared` on assets, `runId` on uploads, and `declared` on
  lineage edges.
- `folders.ensurePath` returns the folder at a path such as `"SH010/anim"`,
  creating each folder on the way that isn't there yet. It reuses a folder of
  the same name under the same parent, so clients saving into one path at once
  share its folders. Pass an array of names when a name contains `/`.
- `folders.create` takes `reuseExisting`: with `true`, a folder of that name
  already under the parent is returned instead of a second one.
- `folders.delete` deletes a folder and its subfolders, keeping their assets or
  trashing them, and `folders.restore` undoes it within an hour. Deleting needs
  the `library:delete` scope.
- `CreateRunRequest` has `seed`, for models that accept one; `labelIds`, which
  label each output as it lands and need the `library:organize` scope; and
  `upscaleDraft`, which upscales an output of a Seedance 2.5 480p Draft to its
  final.
- Assets and runs have `createdBy`, `createdVia` and `webUrl`, and
  `assets.search` filters by `createdBy`.
- `DELETE` requests send an `Idempotency-Key` that their retries reuse, as
  `POST` requests do.

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
