# Changelog

## 0.4.0

This release follows the reshaped `/v1`, and breaks code written for 0.3.0.
The API's old Library routes are gone, so 0.3.0's Library methods stop working
against it.

### Migrating from 0.3.0

| 0.3.0                                                                                                              | 0.4.0                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `assets.update(projectId, assetId, body)`, resolving with an `AssetChange`                                         | `assets.update(assetId, body)`, resolving with the `AssetDetail`                                                         |
| `assets.lineage(assetId)` and the `Lineage` type                                                                   | `assets.sources(assetId)` and `assets.uses(assetId)`, lists of `LineageAsset`, each with its `edges`; `moreUses` is gone |
| `assets.folders(assetId)`, resolving with an `AssetFolders`                                                        | `assets.folders(assetId)`, a list of `AssetFolder`                                                                       |
| `folders.create(projectId, body)`                                                                                  | `folders.create({ projectId, ...body })`                                                                                 |
| `folders.update(projectId, folderId, body)`                                                                        | `folders.update(folderId, body)`                                                                                         |
| `folders.delete(projectId, folderId, query)`                                                                       | `folders.delete(folderId, query)`                                                                                        |
| `folders.restore(projectId, body)`                                                                                 | `folders.restore(body)`                                                                                                  |
| `folders.addAssets`, `moveAssets` and `removeAssets(projectId, folderId, body)`                                    | The same methods with `(folderId, body)`                                                                                 |
| `labels.addAssets` and `removeAssets(projectId, labelId, body)`                                                    | `labels.addAssets` and `removeAssets(labelId, body)`, for up to 100 assets in any project                                |
| `FolderAssetsRequest` and `LabelAssetsRequest`                                                                     | `AssetBatchRequest`                                                                                                      |
| `FolderAssetsChange` and `LabelAssetsChange`                                                                       | `AssetBatchChange`, with `updatedAssetIds` and `skippedAssetIds`                                                         |
| `labels.update(labelId, body)` replaced all three fields                                                           | `labels.update(labelId, body)` changes only the fields you send                                                          |
| `projects.list(options)`                                                                                           | `projects.list(query, options)`, which takes `limit` and pages                                                           |
| `hasEnded(run)` read `status`                                                                                      | `hasEnded(run)` reads `endedAt`                                                                                          |
| `Run["model"]` was a string                                                                                        | It's null for a transform or an upload                                                                                   |
| Response enums were closed unions, such as a run's `status`                                                        | Each also takes any other string, so give a `switch` on one a `default`                                                  |
| `ZeroGenError.details` was `Record<string, unknown>`                                                               | It's `ErrorDetails`, and `ZeroGenError.reason` reads `details.reason`                                                    |
| `uploads.upload` returned `declarationRecorded: false` on any `permission_denied` from declaring an identical file | Only when someone else uploaded it (`not_creator`); a missing scope throws                                               |

`folders.list(projectId)`, `namingPresets.list(projectId)` and
`folders.ensurePath(projectId, path)` keep their signatures.

### Changes

- Waiting ends by the run's `endedAt`, whatever its status, in
  `createAndWait`, `waitFor` and `hasEnded`, so a status added later can't
  keep a wait going.
- Response enums are typed as the values known today or any other string, and
  keep their known values for completion. Requests stay closed.
- `ZeroGenError.reason` is the error's `details.reason`, typed as
  `ErrorReason`: each `rate_limited` and `permission_denied` error has one.
  `details` is typed as `ErrorDetails`, such as `currentVersion` on a
  `version_conflict`.
- Every `POST`, `PATCH` and `DELETE` sends an `Idempotency-Key` that its
  retries reuse.
- Every list pages through the one paginator: await it for a page, or iterate
  it for every item.
- Runs: `runs.list` lists the organization's runs, and filters by
  `createdBy`, `status`, `createdAfter` and `createdBefore`.
  `runs.getOutputDownload` and `runs.downloadOutput` download an output with
  `runs:read` alone, without sending your API key to storage. Runs have
  `kind`, `endedAt` and `request`. `runs.quote` needs only `models:read`,
  and returns the `inputs` to send with the create, which `create` takes.
  `CreateRunRequest` has `continuation`.
- Transforms: `assets.transform` and `assets.transformAndWait` make a free
  Derived copy from a `TransformRecipe`: a `FrameRecipe`, `ImageRecipe`,
  `VideoRecipe` or `AudioRecipe`. `luts.list` lists the LUTs a recipe can
  name.
- Deletes: `assets.delete` moves an asset to Recently deleted, with the
  `library:delete` scope, and `assets.restore` puts it back.
- Reads of one: `projects.get`, `folders.get` and `labels.get`.
- `namingPresets.create` saves a naming preset.
- Attachments: `attachments.list`, `get`, `create`, `revise`, `delete`,
  `restore` and `versions` keep versioned text on projects, folders and
  Story clips.
- Types from the current API, including new models.

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
