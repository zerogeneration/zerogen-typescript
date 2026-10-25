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
`ZEROGEN_API_KEY`.

```ts
import ZeroGen from "@zerogen/sdk";

const zerogen = new ZeroGen(); // Reads ZEROGEN_API_KEY.

const generation = await zerogen.generations.createAndWait({
  model: "openai/gpt-image-2/generate",
  prompt: "A lighthouse at dawn",
});

for (const output of generation.outputs) {
  if (output.asset) console.log(output.asset.id, output.asset.mimeType);
}
```

`createAndWait` starts a generation and resolves when it ends. A generation
that fails resolves too, so check its `status`, and each output's. Each
output's asset is in your organization's Library, in the generation's project:
your team can open and download it in ZeroGen, and you can send its ID as an
input to a later generation. To start a generation without
waiting, use `create`, then `get` or `waitFor` by its `id`.

Requests and responses are typed from the API's
[OpenAPI document](https://api.zerogen.com/v1/openapi.json). Each model takes
its own parameters: read a model's request schema with
`zerogen.models.get(id)`.

## Inputs

Give a generation an input by asset ID or by `https` URL. To upload a file,
use `uploads.upload`, which resolves when the asset is ready:

```ts
import { openAsBlob } from "node:fs";

const upload = await zerogen.uploads.upload(await openAsBlob("storyboard.png"), {
  filename: "storyboard.png",
});

const generation = await zerogen.generations.createAndWait({
  model: "openai/gpt-image-2/edit",
  prompt: "Turn the sky into a sunset",
  inputs: [{ role: "source", asset: upload.assetId }],
});
```

`upload` takes a `Blob`, `File`, `ArrayBuffer`, or `Uint8Array`. It takes the
media type from the file, or from the filename's extension. For files up to
64 MiB, it sends the file's SHA-256 digest, so a file the project already has
is reused instead of uploaded again.

## Lists

List methods return one page when awaited, and every item on every page when
iterated:

```ts
for await (const model of zerogen.models.list({ capability: "video" })) {
  console.log(model.id);
}

const page = await zerogen.generations.list({ limit: 20 });
console.log(page.data, page.nextCursor);
```

## Errors

A request the API refuses throws a `ZeroGenError`. Branch on its `code`,
which is stable; its `message` is for people.

```ts
import { ZeroGenError } from "@zerogen/sdk";

try {
  await zerogen.generations.create({ model: "openai/gpt-image-2/generate", prompt: "" });
} catch (error) {
  if (error instanceof ZeroGenError) {
    console.log(error.status, error.code, error.param, error.requestId);
  }
  throw error;
}
```

A request that gets no response, because the connection failed or the request
timed out, throws a `ZeroGenConnectionError`. For every code, see
[Errors](https://docs.zerogen.com/errors).

## Retries and idempotency

The client retries connection errors and errors the API marks `retryable`,
twice by default, with backoff. For `429` responses, it waits for
`Retry-After`, unless that's more than a minute.

Every `POST` sends an `Idempotency-Key`, and a call's retries reuse it, so a
retried create never starts a second generation. To retry safely across calls
or processes, pass your own key:

```ts
await zerogen.generations.create(request, { idempotencyKey: job.id });
```

## Options

```ts
const zerogen = new ZeroGen({
  apiKey: process.env.ZEROGEN_API_KEY,
  maxRetries: 2,
  timeout: 120_000, // Milliseconds per attempt. Waits on a generation add their wait.
});
```

Each method also takes request options: `signal`, `timeout`, `maxRetries`,
`idempotencyKey`, and `headers`. Abort a `createAndWait` or `waitFor` with
`signal` to stop waiting; the generation keeps running.

## Test keys

A test key runs every request on placeholder providers and charges nothing.
Its generations can rehearse failures with the `test` field. For details, see
[Test keys](https://docs.zerogen.com/test-keys).

## License

MIT
