# Agent guidance for zerogen-typescript

`@zerogen/sdk`, the TypeScript client for ZeroGen's public REST API. The API,
its OpenAPI document and its docs live in
[zerogeneration/platform](https://github.com/zerogeneration/platform)
(`apps/web/src/app/v1`, `apps/api-docs`); that repo's ADR-0027 owns the API's
decisions.

## Rules

- `src/openapi.ts` is generated: never edit it by hand. After the API changes,
  run `npm run spec`, which fetches the live document and regenerates the
  types, then update the hand-written methods in `src/resources` to match.
  For a document that isn't deployed yet, copy the platform's
  `apps/api-docs/openapi.json` here and run `npm run generate`.
- The library has no runtime dependencies and runs on any runtime with
  `fetch`, Web Crypto and `AbortSignal.any`. Don't import `node:` modules in
  `src`; `tsconfig.json` leaves out Node's types to keep it that way.
- Every `POST` sends an `Idempotency-Key` that the call's retries reuse.
  Retries follow the error's `retryable` and `Retry-After`; keep it that way.
- Before you commit, run `npm run check` (typecheck, Biome, tests, build).

## Releases

1. Bump `version` in `package.json` and `VERSION` in `src/version.ts`, and add
   a `CHANGELOG.md` entry. Merge the change.
2. Publish a GitHub release whose tag is `v` plus the version, such as
   `v0.2.0`. The `Release` workflow checks the tag, runs `npm run check`, and
   publishes to npm through trusted publishing, with provenance.

npm's trusted publisher for `@zerogen/sdk` names this repository, the
`release.yml` workflow and the `npm` environment. Publishing is Xuelong's call:
don't publish a release unless he asks.
