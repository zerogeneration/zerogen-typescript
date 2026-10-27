import { describe, expect, it } from "vitest";
import ZeroGen, { ZeroGenError } from "../src/index.js";
import { fakeFetch, json } from "./fake-fetch.js";

const client = (fetch: ReturnType<typeof fakeFetch>["fetch"]) =>
  new ZeroGen({ apiKey: "zg_test_key", fetch, defaultHeaders: { "X-Team": "studio" } });

const BASE = "https://api.zerogen.com/v1";
const assetIds = ["a1", "a2"];

describe("Library", () => {
  it("sends each method to its route", async () => {
    const cases: [string, (z: ZeroGen) => PromiseLike<unknown>, string, unknown?][] = [
      ["GET /projects", (z) => z.projects.list(), "/projects"],
      ["GET /assets/a1", (z) => z.assets.get("a1"), "/assets/a1"],
      ["GET /assets/a1/lineage", (z) => z.assets.lineage("a1"), "/assets/a1/lineage"],
      ["GET /assets/a1/folders", (z) => z.assets.folders("a1"), "/assets/a1/folders"],
      ["GET /assets/a1/download", (z) => z.assets.getDownload("a1"), "/assets/a1/download"],
      [
        "PATCH /projects/p1/assets/a1",
        (z) => z.assets.update("p1", "a1", { favorite: true }),
        "/projects/p1/assets/a1",
        { favorite: true },
      ],
      [
        "GET /projects/p1/folders",
        (z) => z.folders.list("p1", { limit: 100 }),
        "/projects/p1/folders?limit=100",
      ],
      [
        "POST /projects/p1/folders",
        (z) => z.folders.create("p1", { name: "Selects" }),
        "/projects/p1/folders",
        { name: "Selects" },
      ],
      [
        "PATCH /projects/p1/folders/f1",
        (z) => z.folders.update("p1", "f1", { parentId: null }),
        "/projects/p1/folders/f1",
        { parentId: null },
      ],
      [
        "POST /projects/p1/folders/f1/assets",
        (z) => z.folders.addAssets("p1", "f1", { assetIds }),
        "/projects/p1/folders/f1/assets",
        { assetIds },
      ],
      [
        "POST /projects/p1/folders/f1/assets/move",
        (z) => z.folders.moveAssets("p1", "f1", { assetIds, fromFolderId: "f0" }),
        "/projects/p1/folders/f1/assets/move",
        { assetIds, fromFolderId: "f0" },
      ],
      [
        "POST /projects/p1/folders/f1/assets/remove",
        (z) => z.folders.removeAssets("p1", "f1", { assetIds }),
        "/projects/p1/folders/f1/assets/remove",
        { assetIds },
      ],
      [
        "GET /labels",
        (z) => z.labels.list({ includeArchived: false }),
        "/labels?includeArchived=false",
      ],
      ["POST /labels", (z) => z.labels.create({ name: "Hero" }), "/labels", { name: "Hero" }],
      [
        "PUT /labels/l1",
        (z) => z.labels.update("l1", { name: "Hero", description: "", color: "#3b82f6" }),
        "/labels/l1",
        { name: "Hero", description: "", color: "#3b82f6" },
      ],
      ["POST /labels/l1/archive", (z) => z.labels.archive("l1"), "/labels/l1/archive"],
      ["POST /labels/l1/restore", (z) => z.labels.restore("l1"), "/labels/l1/restore"],
      [
        "POST /projects/p1/labels/l1/assets",
        (z) => z.labels.addAssets("p1", "l1", { assetIds }),
        "/projects/p1/labels/l1/assets",
        { assetIds },
      ],
      [
        "POST /projects/p1/labels/l1/assets/remove",
        (z) => z.labels.removeAssets("p1", "l1", { assetIds }),
        "/projects/p1/labels/l1/assets/remove",
        { assetIds },
      ],
      [
        "GET /projects/p1/naming-presets",
        (z) => z.namingPresets.list("p1"),
        "/projects/p1/naming-presets",
      ],
      ["GET /skills", (z) => z.skills.list({ projectId: "p1" }), "/skills?projectId=p1"],
      ["GET /skills/s1", (z) => z.skills.get("s1", { projectId: "p1" }), "/skills/s1?projectId=p1"],
    ];
    for (const [name, call, path, body] of cases) {
      const { fetch, calls } = fakeFetch(json({ data: [], nextCursor: null }));
      await call(client(fetch));
      const [method] = name.split(" ");
      expect(calls[0], name).toMatchObject({ method, url: BASE + path });
      expect(
        calls[0]?.body === undefined ? undefined : JSON.parse(calls[0].body as string),
        name,
      ).toEqual(body);
      expect(calls[0]?.headers["idempotency-key"] !== undefined, name).toBe(method === "POST");
    }
  });

  it("encodes IDs into the path", async () => {
    const { fetch, calls } = fakeFetch(json({}));
    await client(fetch).folders.update("p/1", "f 1", { name: "Selects" });
    expect(calls[0]?.url).toBe(`${BASE}/projects/p%2F1/folders/f%201`);
  });

  it("searches assets with repeated filters, and sends favorite only when it's true", async () => {
    const { fetch, calls } = fakeFetch(
      json({ data: [{ id: "a1" }], nextCursor: "c2" }),
      json({ data: [{ id: "a2" }], nextCursor: null }),
      json({ data: [], nextCursor: null }),
    );
    const zerogen = client(fetch);
    const ids: string[] = [];
    for await (const asset of zerogen.assets.search({
      projectId: "p1",
      folderId: "unfiled",
      favorite: true,
      labelId: ["l1", "l2"],
      resolution: ["4k", "1080p"],
    }))
      ids.push(asset.id);
    await zerogen.assets.search({ favorite: false });
    expect(ids).toEqual(["a1", "a2"]);
    const query =
      "projectId=p1&folderId=unfiled&labelId=l1&labelId=l2&resolution=4k&resolution=1080p&favorite=true";
    expect(calls.map((call) => call.url)).toEqual([
      `${BASE}/assets?${query}`,
      `${BASE}/assets?${query}&cursor=c2`,
      `${BASE}/assets`,
    ]);
  });
});

describe("assets.download", () => {
  const link = (url: string) => ({
    assetId: "a1",
    projectId: "p1",
    url,
    expiresAt: "2026-10-27T00:05:00.000Z",
    filename: "lighthouse.png",
    mimeType: "image/png",
    sizeBytes: 5,
  });
  const signed = "https://storage.example.com/a1.png?X-Amz-Signature=secret";

  it("fetches the file from the signed URL without the API key or any client headers", async () => {
    const { fetch, calls } = fakeFetch(json(link(signed)), new Response("bytes"));
    const file = await client(fetch).assets.download("a1", { headers: { "X-Trace": "t1" } });
    expect(file.filename).toBe("lighthouse.png");
    expect(await file.response.text()).toBe("bytes");
    expect(calls[0]).toMatchObject({
      url: `${BASE}/assets/a1/download`,
      headers: { authorization: "Bearer zg_test_key", "x-team": "studio", "x-trace": "t1" },
    });
    expect(calls[1]).toMatchObject({ method: "GET", url: signed });
    expect(calls[1]?.headers).toEqual({});
  });

  it("reads a fresh link once when storage refuses an expired one", async () => {
    const fresh = "https://storage.example.com/a1.png?X-Amz-Signature=fresh";
    const { fetch, calls } = fakeFetch(
      json(link(signed)),
      new Response(
        "<Error><Code>AccessDenied</Code><Message>Request has expired</Message></Error>",
        {
          status: 403,
        },
      ),
      json(link(fresh)),
      new Response("bytes"),
    );
    const file = await client(fetch).assets.download("a1");
    expect(file.url).toBe(fresh);
    expect(calls.map((call) => call.url)).toEqual([
      `${BASE}/assets/a1/download`,
      signed,
      `${BASE}/assets/a1/download`,
      fresh,
    ]);
  });

  it("reports a storage error without quoting the signed request", async () => {
    const refusal = () =>
      new Response(
        "<Error><Code>SignatureDoesNotMatch</Code><Message>The request signature does not match.</Message>" +
          "<SignatureProvided>secret</SignatureProvided><CanonicalRequest>GET /a1.png X-Amz-Credential=AKIA</CanonicalRequest></Error>",
        { status: 403 },
      );
    const { fetch } = fakeFetch(json(link(signed)), refusal(), json(link(signed)), refusal());
    const error = await client(fetch)
      .assets.download("a1")
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ZeroGenError);
    expect((error as ZeroGenError).status).toBe(403);
    expect((error as ZeroGenError).message).toBe(
      "Storage answered HTTP 403: SignatureDoesNotMatch: The request signature does not match.",
    );
    expect((error as ZeroGenError).message).not.toMatch(/secret|AKIA|storage\.example/u);
  });

  it("retries a storage failure on the same link", async () => {
    const { fetch, calls } = fakeFetch(
      json(link(signed)),
      new Response("", { status: 503, headers: { "Retry-After": "0" } }),
      new Response("bytes"),
    );
    const file = await client(fetch).assets.download("a1");
    expect(await file.response.text()).toBe("bytes");
    expect(calls.map((call) => call.url)).toEqual([`${BASE}/assets/a1/download`, signed, signed]);
  });
});
