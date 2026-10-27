import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import ZeroGen, { VERSION, ZeroGenConnectionError, ZeroGenError } from "../src/index.js";
import { apiError, fakeFetch, json } from "./fake-fetch.js";

const client = (fetch: ReturnType<typeof fakeFetch>["fetch"], maxRetries = 2) =>
  new ZeroGen({ apiKey: "zg_test_key", fetch, maxRetries });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ZeroGen", () => {
  it("reads the key and base URL from the environment", async () => {
    vi.stubEnv("ZEROGEN_API_KEY", "zg_env_key");
    vi.stubEnv("ZEROGEN_BASE_URL", "https://api.zerogen.test/v1/");
    const { fetch, calls } = fakeFetch(json({}));
    await new ZeroGen({ fetch }).me();
    expect(calls[0]?.url).toBe("https://api.zerogen.test/v1/me");
    expect(calls[0]?.headers.authorization).toBe("Bearer zg_env_key");
  });

  it("refuses to start without a key", () => {
    vi.stubEnv("ZEROGEN_API_KEY", "");
    expect(() => new ZeroGen()).toThrow(/ZEROGEN_API_KEY/u);
  });

  it("sends GET requests with a query string and no idempotency key", async () => {
    const { fetch, calls } = fakeFetch(json({ currency: "USD" }));
    await client(fetch).balance({ projectId: "p1" });
    expect(calls[0]?.url).toBe("https://api.zerogen.com/v1/balance?projectId=p1");
    expect(calls[0]?.headers).toMatchObject({
      accept: "application/json",
      "user-agent": `zerogen-typescript/${VERSION}`,
    });
    expect(calls[0]?.headers["idempotency-key"]).toBeUndefined();
  });

  it("gives each POST an idempotency key, and sends no body or content type when it has none", async () => {
    const { fetch, calls } = fakeFetch(json({ id: "r1" }), json({ id: "r1" }));
    const zerogen = client(fetch);
    await zerogen.runs.cancel("r1");
    await zerogen.runs.cancel("r1", { idempotencyKey: "mine" });
    expect(calls[0]?.headers["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/u);
    expect(calls[0]?.headers["content-type"]).toBeUndefined();
    expect(calls[0]?.body).toBeUndefined();
    expect(calls[1]?.headers["idempotency-key"]).toBe("mine");
  });

  it("throws the error envelope with its request ID", async () => {
    const { fetch } = fakeFetch(apiError(400, "validation_failed", { param: "output.count" }));
    const error = await client(fetch)
      .runs.create({ model: "a/b/generate" })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ZeroGenError);
    expect(error).toMatchObject({
      status: 400,
      code: "validation_failed",
      param: "output.count",
      retryable: false,
      requestId: "req_test",
    });
  });

  it("retries a retryable response after Retry-After with the same idempotency key", async () => {
    const { fetch, calls } = fakeFetch(
      apiError(429, "rate_limited", { retryable: true, headers: { "Retry-After": "0" } }),
      apiError(409, "idempotency_in_progress", {
        retryable: true,
        headers: { "Retry-After": "0" },
      }),
      json({ id: "r1", status: "queued" }, 202),
    );
    const run = await client(fetch).runs.create({ model: "a/b/generate" });
    expect(run.id).toBe("r1");
    expect(calls).toHaveLength(3);
    expect(new Set(calls.map((call) => call.headers["idempotency-key"])).size).toBe(1);
  });

  it("doesn't retry an error that isn't retryable, or a Retry-After over a minute", async () => {
    const refused = fakeFetch(apiError(402, "insufficient_balance"));
    await expect(client(refused.fetch).me()).rejects.toMatchObject({
      code: "insufficient_balance",
    });
    expect(refused.calls).toHaveLength(1);

    const later = fakeFetch(
      apiError(429, "rate_limited", { retryable: true, headers: { "Retry-After": "120" } }),
    );
    await expect(client(later.fetch).me()).rejects.toMatchObject({ code: "rate_limited" });
    expect(later.calls).toHaveLength(1);
  });

  it("stops retrying after maxRetries", async () => {
    const retry = { retryable: true, headers: { "Retry-After": "0" } };
    const { fetch, calls } = fakeFetch(
      apiError(500, "internal", retry),
      apiError(500, "internal", retry),
    );
    await expect(client(fetch, 1).me()).rejects.toMatchObject({ status: 500, code: "internal" });
    expect(calls).toHaveLength(2);
  });

  it("reads a response that isn't the error envelope", async () => {
    const { fetch } = fakeFetch(new Response("<html>Bad gateway</html>", { status: 502 }));
    await expect(client(fetch, 0).me()).rejects.toMatchObject({
      status: 502,
      code: "unexpected_response",
      retryable: true,
    });
  });

  it("retries a connection error, then reports it", async () => {
    const { fetch, calls } = fakeFetch(
      new TypeError("fetch failed"),
      new TypeError("fetch failed"),
    );
    const error = await client(fetch, 1)
      .me()
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ZeroGenConnectionError);
    expect((error as Error).cause).toBeInstanceOf(TypeError);
    expect(calls).toHaveLength(2);
  });

  it("stops at once when the caller aborts", async () => {
    const controller = new AbortController();
    const { fetch, calls } = fakeFetch(() => {
      controller.abort(new Error("stop"));
      throw new TypeError("aborted");
    });
    await expect(client(fetch).me({ signal: controller.signal })).rejects.toThrow("stop");
    expect(calls).toHaveLength(1);
  });

  it("encodes each segment of a model ID into the path", async () => {
    const { fetch, calls } = fakeFetch(json({ id: "openai/gpt-image-2/generate" }));
    await client(fetch).models.get("openai/gpt-image-2/generate");
    expect(calls[0]?.url).toBe("https://api.zerogen.com/v1/models/openai/gpt-image-2/generate");
  });

  it("states the package's version", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(VERSION).toBe(pkg.version);
  });
});
