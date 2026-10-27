# Agent guidance for zerogen-typescript

`@zerogen/sdk`, the TypeScript client for the
[ZeroGen API](https://docs.zerogen.com). The API's
[OpenAPI document](https://api.zerogen.com/v1/openapi.json) is the contract;
this library adds retries, idempotency, waiting, pagination and uploads on top
of the types generated from it.

## Rules

- `src/openapi.ts` is generated: never edit it by hand. After the API changes,
  run `npm run spec`, which fetches the published document into `openapi.json`
  and regenerates the types, then update the methods in `src/resources` to
  match. To build against a document that isn't published yet, put it in
  `openapi.json` and run `npm run generate`.
- The library has no runtime dependencies and runs on any runtime with
  `fetch`, Web Crypto and `AbortSignal.any`. Don't import `node:` modules in
  `src`; `tsconfig.json` leaves out Node's types to keep it that way.
- Every `POST` sends an `Idempotency-Key` that the call's retries reuse.
  Retries follow the error's `retryable` and `Retry-After`; keep it that way.
- Tests use a scripted `fetch` (`test/fake-fetch.ts`) and never call the API.
- Before you commit, run `npm run check` (typecheck, Biome, tests, build).
  CI runs it on every pull request, on Node 20, 22 and 24.

## Releases

Maintainers publish releases:

1. Bump `version` in `package.json` and `VERSION` in `src/version.ts`, and add
   a `CHANGELOG.md` entry. Merge the change.
2. Publish a GitHub release whose tag is `v` plus the version, such as
   `v0.2.0`. The `Release` workflow checks the tag, runs `npm run check`, and
   publishes to npm through trusted publishing, with provenance.
