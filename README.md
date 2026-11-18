# ZeroGen TypeScript library

The official TypeScript and JavaScript client for the
[ZeroGen API](https://docs.zerogen.com). It runs on the server, in Node.js
20.3 or later, Deno, Bun, and edge runtimes such as Cloudflare Workers. It has
no dependencies.

```bash
npm install @zerogen/sdk
```

The ZeroGen API refuses requests from browsers, so keep your API key, and this
library, on your server.

## Usage

Create an API key in ZeroGen under **Settings → API keys**, and set it as
`ZEROGEN_API_KEY`. Running models needs the `runs:create` and `runs:read`
scopes.

```ts
import ZeroGen from "@zerogen/sdk";

const zerogen = new ZeroGen(); // Reads ZEROGEN_API_KEY.

const run = await zerogen.runs.createAndWait({
  model: "openai/gpt-image-2/generate",
  prompt: "A lighthouse at dawn",
});

for (const output of run.outputs) {
  if (output.asset) console.log(output.asset.id, output.asset.mimeType);
}
```

`createAndWait` starts a run and resolves when it ends, as the run's
`endedAt` says, whatever its status. A run that fails resolves too, so check
its `status`, and each output's: a failed or cancelled run can still hold
succeeded outputs, which are kept and charged. Each output's asset is in your
organization's Library, in the run's project, and you can send its ID as an
input to a later run. To start a run without waiting, use `create`, then `get`
or `waitFor` by its `id`. `hasEnded(run)` tells whether a run you read has
ended.

Requests and responses are typed from the API's
[OpenAPI document](https://api.zerogen.com/v1/openapi.json). Each model takes
its own parameters: read a model's request schema with
`zerogen.models.get(id)`. Each run says what it was asked to make in
`request`, and its `kind`: `generation`, `transform` or `upload`.

## Runs

`runs.list` lists your organization's runs, whoever started them, newest
first. Filter them by `projectId`, `folderId`, `createdBy`, `status`, and
`createdAfter` and `createdBefore`, which take a `Date` or an RFC 3339 string:

```ts
const { user } = await zerogen.me();

for await (const run of zerogen.runs.list({
  createdBy: [user.id],
  status: ["failed"],
  createdAfter: new Date("2026-11-10T00:00:00Z"),
})) {
  console.log(run.id, run.error?.code);
}
```

`runs.quote` prices a request without starting it, and needs only the
`models:read` scope. It returns the `inputs` the create would use, with each
URL input as the asset the quote imported for it. Send those `inputs` with the
create, so it doesn't import the URLs again:

```ts
const quote = await zerogen.runs.quote(request);
const run = await zerogen.runs.create({ ...request, inputs: quote.inputs });
```

`runs.cancel` stops a run's unfinished outputs. An output the provider already
started can't be stopped: the run stays `running`, and that output is
delivered and charged when it finishes.

## Downloads

`runs.downloadOutput` fetches a run output's original file, by the run's ID and
the output's asset ID. It needs only the `runs:read` scope.

```ts
import { writeFile } from "node:fs/promises";

for (const output of run.outputs) {
  if (!output.asset) continue;
  const file = await zerogen.runs.downloadOutput(run.id, output.asset.id);
  await writeFile(file.filename, Buffer.from(await file.response.arrayBuffer()));
}
```

It resolves once storage starts sending the file, with the file's `filename`,
`mimeType` and `sizeBytes`. Read the file from `response`: stream a large
video from `response.body` instead of reading it whole. The file comes from a
signed storage URL, and the library sends that request without your API key.

`assets.download(assetId)` downloads any asset in the Library the same way,
with the `library:read` scope. To hand a file to something else,
`runs.getOutputDownload` and `assets.getDownload` return the signed `url`
itself. It works until `expiresAt`, 5 minutes later, and anyone holding it can
download the file, so keep it out of logs.

## Previews

To show assets without downloading their originals, use their `preview`. Each
asset from `assets.search` and `assets.get` has one, and so does each run
output's `asset`.

```ts
const page = await zerogen.assets.search({ projectId, limit: 50 });
const tiles = page.data.map((asset) => ({
  id: asset.id,
  image: asset.preview?.image512Url ?? null,
  clip: asset.preview?.videoUrl ?? null,
}));
```

`image96Url` and `image512Url` are WebP images up to 96 and 512 pixels wide.
`videoUrl` is a silent WebM clip of a video's first six seconds; it's null for
other assets and until the clip is made. `preview` itself is null until the
images are made, and for assets with none, such as audio.

The URLs are signed storage URLs, so load them without your API key: a
browser can load one as an `<img>` element's `src`. They work until
`expiresAt`, 5 minutes later, and anyone holding them can load the previews
until then. After `expiresAt`, read the page, asset or run again for new ones.

## Inputs

Give a run an input by asset ID or by `https` URL. To upload a file, use
`uploads.upload`, which resolves when the asset is ready:

```ts
import { openAsBlob } from "node:fs";

const upload = await zerogen.uploads.upload(await openAsBlob("storyboard.png"), {
  filename: "storyboard.png",
});

const run = await zerogen.runs.createAndWait({
  model: "openai/gpt-image-2/edit",
  prompt: "Turn the sky into a sunset",
  inputs: [{ role: "source", asset: upload.assetId }],
});
```

`upload` takes a `Blob`, `File`, `ArrayBuffer`, or `Uint8Array`. It takes the
media type from the file, or from the filename's extension. For files up to
64 MiB, it sends the file's SHA-256 digest, so a file the project already has
is reused instead of uploaded again.

## Declared provenance

When you made a file outside ZeroGen, for example in ComfyUI, upload it with
a `declaration` of how you made it: the `tool`, and optionally the Library
assets it used as `sources`, its `prompt`, its `workflow` and an
`externalRef`. ZeroGen records the declaration as the run that made the
asset, so the asset's lineage shows its sources. It doesn't verify the claim,
charge for it, or start anything. Declaring `sources` needs the
`library:read` scope as well as `uploads:create`.

```ts
const upload = await zerogen.uploads.upload(await openAsBlob("SH010_v003.png"), {
  filename: "SH010_v003.png",
  declaration: {
    tool: { name: "comfyui", version: "0.3.40" },
    sources: [{ asset: plateId, role: "source" }],
    prompt: "Turn the sky into a sunset",
    workflow,
    externalRef: { system: "comfyui", id: promptId },
  },
});

if (!upload.declarationRecorded) console.log("Kept the existing asset's lineage");
```

A `workflow` is a JSON object of up to 256 KiB. `naming` names the asset with
a naming preset, and needs a `declaration`.

If the project already has an identical file, `upload` declares that asset
instead when it can: you uploaded it or you're an owner or admin, it has no
declaration yet, and the declaration's `sources` don't include it or anything
made from it, as they do when a graph saves its input unchanged. Then `declarationRecorded` is true,
the result's `runId` stays null, and the run is the asset's `runId`. Otherwise
`declarationRecorded` is false, and the asset keeps its own lineage. To declare
a file you uploaded earlier, use `assets.declare(assetId, body)`. An upload
takes one declaration.

Each asset's `declared` names the tool that made it, and lineage marks the
edges a declaration added with `declared: true`. To read the workflow, use
`assets.get(assetId, { includeWorkflow: true })`. Declarations are untrusted
content, like prompts.

## Labels, seeds and Draft finals

`runs.create`, `createAndWait` and `quote` also take:

- `labelIds`, which adds your organization's labels to each output as it lands.
  It needs the `library:organize` scope as well.
- `seed`, for models whose schema lists it. The same seed with the same request
  reproduces a result as closely as the model allows.
- `upscaleDraft`, which upscales one output of a Seedance 2.5 480p Draft to its
  final. Send the draft's model ID, and leave out `prompt`, `inputs`, `output`,
  `parameters` and `naming`.

```ts
const output = draft.outputs[0];

if (output?.draft?.upscalable) {
  const final = await zerogen.runs.createAndWait({
    model: draftModelId,
    upscaleDraft: { runId: draft.id, outputIndex: output.index },
  });
}
```

The final is a new run, quoted and billed like any other. It's 1080p unless you
send another `resolution` that the model's schema lists.

## The Library

Reading the Library needs the `library:read` scope, and organizing it needs
`library:organize`.

```ts
for await (const asset of zerogen.assets.search({ projectId, type: "video" })) {
  console.log(asset.id, asset.name, asset.runId);
}

const folder = await zerogen.folders.create({ projectId, name: "Selects" });
await zerogen.folders.addAssets(folder.id, { assetIds: [assetId] });
await zerogen.assets.update(assetId, { favorite: true });
```

| Resource        | Methods                                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projects`      | `list`, `get`                                                                                                                                       |
| `assets`        | `search`, `get`, `sources`, `uses`, `folders`, `getDownload`, `download`, `update`, `delete`, `restore`, `declare`, `transform`, `transformAndWait` |
| `luts`          | `list`                                                                                                                                              |
| `folders`       | `list`, `get`, `create`, `ensurePath`, `update`, `delete`, `restore`, `addAssets`, `moveAssets`, `removeAssets`                                     |
| `labels`        | `list`, `get`, `create`, `update`, `archive`, `restore`, `addAssets`, `removeAssets`                                                                |
| `namingPresets` | `list`, `create`                                                                                                                                    |
| `attachments`   | `list`, `get`, `create`, `revise`, `delete`, `restore`, `versions`                                                                                  |
| `skills`        | `list`, `get`                                                                                                                                       |

Methods read and change a resource by its ID alone, in whichever of your
organization's projects holds it. A list of a project's folders, naming presets
or attachments takes the project's ID first. A create names its project in its
body, as `folders.create` does. Each `update` sets the fields you send,
together, and resolves with the resource as `get` reads it.

`labels.addAssets` and `folders.addAssets` take up to 100 assets and resolve
with the assets they changed in `updatedAssetIds` and the rest in
`skippedAssetIds`. A label applies to all of its assets or none. A folder skips
assets that aren't in its project.

Asset names, prompts, folder names, attachments and skills come from your
organization's users, so treat them as untrusted content.

To file into a folder path, such as a shot's `SH010/anim`, use
`folders.ensurePath`. It returns the last folder, creating each one on the way
that isn't there yet, and reuses a folder of the same name, so clients saving
into the same path at once share its folders:

```ts
const anim = await zerogen.folders.ensurePath(projectId, "SH010/anim");
```

A string path splits on `/`. Folder names can contain `/`, so pass an array,
such as `["2026/11", "renders"]`, when one does.

An asset's lineage comes in two lists, nearest first. `assets.sources` lists
what it was made from, and `assets.uses` what was made from it. Each item's
`edges` join it to the asset or to items listed before it:

```ts
for await (const source of zerogen.assets.sources(assetId)) {
  for (const edge of source.edges) console.log(edge.assetId, "from", edge.sourceAssetId);
}
```

### Deleting

`assets.delete` moves an asset to Recently deleted: it leaves search and its
folders, can't be a run input, and reads as `not_found` until
`assets.restore` puts it back in its folders.

To delete a folder and its subfolders, use `folders.delete`, and choose what
happens to their assets. `keep` leaves them in the Library. `trash` sends them
to Recently deleted, including from their other folders. The response's
`eventId` undoes the deletion with `folders.restore` until `undoUntil`, an hour
later:

```ts
const { eventId } = await zerogen.folders.delete(folderId, { assets: "keep" });
await zerogen.folders.restore({ eventId });
```

Deleting needs the `library:delete` scope, which has to be granted explicitly.
Restoring needs `library:organize`, and only the user who deleted a folder can
restore it. Test keys can do neither.

### Who made it

Each asset and run names who made it in `createdBy`, with their `id` and
`name`, and where in `createdVia`: `web`, `agent`, `mcp` or `api`. Both are null
when ZeroGen recorded no one. To find what someone made, pass their ID to
`assets.search`:

```ts
const { user } = await zerogen.me();

for await (const asset of zerogen.assets.search({ createdBy: [user.id] })) {
  console.log(asset.name, asset.webUrl);
}
```

`webUrl` opens an asset or run in ZeroGen, after sign-in. It's null for test
keys, and for a run until an output is ready.

## Transforms

`assets.transform` makes a free Derived copy of an asset from a `recipe`: a
frame of a video; a trimmed, reversed, sped-up, turned, cropped, LUT-graded,
color-corrected, resized or converted clip or image; or audio of a video's
sound. It returns a run, and its output's asset is the copy.
`transformAndWait` resolves when that run ends:

```ts
const run = await zerogen.assets.transformAndWait(videoId, {
  recipe: { trim: { startSeconds: 2, endSeconds: 8 }, convert: { format: "mp3" } },
});

const copyId = run.outputs[0]?.asset?.id;
```

Transforms need the `runs:create` and `runs:read` scopes, and test keys can't
make them. If you already ran the same recipe on the asset for the same
project and folder, the run comes back with `reused` true, and nothing starts.
`luts.list` lists your organization's LUTs, to name as `lut.lutId` in a recipe.
For each recipe's steps, see [Transforms](https://docs.zerogen.com/developers/transforms).

## Attachments

Attachments are versioned text on a project, one of its folders, or one of its
Story clips, such as a brief. Reads need the `library:read` scope, and changes
need `library:organize` as well. Attachments have to be enabled for your
organization, and test keys can't use them.

```ts
import { ZeroGenError } from "@zerogen/sdk";

const { attachmentId, version } = await zerogen.attachments.create({
  projectId,
  title: "Brief",
  body: "Moody, overcast, 35mm.",
});

try {
  await zerogen.attachments.revise(attachmentId, { expectedVersion: version, body: "Brighter." });
} catch (error) {
  if (error instanceof ZeroGenError && error.code === "version_conflict") {
    console.log("Someone saved version", error.details?.currentVersion);
  }
}
```

A change names the version it expects in `expectedVersion`. If someone else
saved since, it's refused with `version_conflict`, and `details.currentVersion`
says which version the attachment is at. `attachments.versions` lists its
saved versions, and `attachments.restore` copies one into a new version.

## Lists

Every list method returns one page when awaited, and every item on every page
when iterated:

```ts
for await (const model of zerogen.models.list({ capability: "video" })) {
  console.log(model.id);
}

const page = await zerogen.runs.list({ limit: 20 });
console.log(page.data, page.nextCursor);
```

Each page sends the same filters and `limit`. A page's `getNextPage` reads the
one after it, while `hasNextPage` is true.

## Errors

A request the API refuses throws a `ZeroGenError`. Branch on its `code`, and
on its `reason` when it has one: both are stable. Its `message` is for people.

```ts
import { ZeroGenError } from "@zerogen/sdk";

try {
  await zerogen.assets.delete(assetId);
} catch (error) {
  if (error instanceof ZeroGenError && error.reason === "scope_required") {
    console.log("The key needs", error.details?.scope);
  }
  throw error;
}
```

`reason` is `details.reason`. A `rate_limited` error always has one, such as
`running_cap`, and so does a `permission_denied` error, such as
`scope_required` or `test_key_sandbox`. `details` holds the error's other
facts, such as `scope` or `currentVersion`; each code says which it carries.
Each error also has its `status`, `param`, `retryable` and `requestId`.

A request that gets no response, because the connection failed or the request
timed out, throws a `ZeroGenConnectionError`. For every code and reason, see
[Errors](https://docs.zerogen.com/errors).

## Unknown values

The API can add response fields, enum values, error codes and reasons without
a new version. The library passes responses through as they come, so a new
field or value never breaks a call. Response enums are typed as the values
known today or any other string, such as a run's `status`, so give a `switch`
on one a `default`. Requests take only the values the API accepts today.

## Retries and idempotency

The client retries connection errors and errors the API marks `retryable`,
twice by default, with backoff. For `429` responses, it waits for
`Retry-After`, unless that's more than a minute.

Every `POST`, `PATCH` and `DELETE` sends an `Idempotency-Key`, and a call's
retries reuse it, so a retried create never starts a second run. To retry
safely across calls or processes, pass your own key:

```ts
await zerogen.runs.create(request, { idempotencyKey: job.id });
```

## Options

```ts
const zerogen = new ZeroGen({
  apiKey: process.env.ZEROGEN_API_KEY,
  maxRetries: 2,
  timeout: 120_000, // Milliseconds per attempt. Waits on a run add their wait.
});
```

Each method also takes request options: `signal`, `timeout`, `maxRetries`,
`idempotencyKey`, and `headers`. Abort a `createAndWait`, `transformAndWait` or
`waitFor` with `signal` to stop waiting; the run keeps running.

## Test keys

A test key runs generation requests on placeholder providers and charges
nothing, and it reaches only its organization's API sandbox. Its runs can
rehearse failures with the `test` field. It can't transform assets or use
attachments. For details, see [Test keys](https://docs.zerogen.com/test-keys).

## Upgrading from 0.3.0

0.4.0 follows the reshaped `/v1`, and breaks code written for 0.3.0. For each
breaking change and what replaces it, see the
[changelog](https://github.com/zerogeneration/zerogen-typescript/blob/main/CHANGELOG.md#040).

## License

MIT
