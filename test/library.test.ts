import { describe, expect, it } from "vitest";
import ZeroGen, {
  type Asset,
  type AssetDetail,
  type AssetPreview,
  type Creator,
  type FolderDelete,
  type FolderRestore,
  type Lineage,
  type RequestOptions,
  ZeroGenError,
} from "../src/index.js";
import { apiError, fakeFetch, json } from "./fake-fetch.js";

const client = (fetch: ReturnType<typeof fakeFetch>["fetch"]) =>
  new ZeroGen({ apiKey: "zg_test_key", fetch, defaultHeaders: { "X-Team": "studio" } });

const BASE = "https://api.zerogen.com/v1";
const assetIds = ["a1", "a2"];

describe("Library", () => {
  it("sends each method to its route", async () => {
    const cases: [string, (z: ZeroGen) => PromiseLike<unknown>, string, unknown?][] = [
      ["GET /projects", (z) => z.projects.list(), "/projects"],
      ["GET /assets/a1", (z) => z.assets.get("a1"), "/assets/a1"],
      [
        "GET /assets/a1?includeWorkflow=true",
        (z) => z.assets.get("a1", { includeWorkflow: true }),
        "/assets/a1?includeWorkflow=true",
      ],
      [
        "POST /assets/a1/declaration",
        (z) => z.assets.declare("a1", { tool: { name: "ffmpeg" } }),
        "/assets/a1/declaration",
        { tool: { name: "ffmpeg" } },
      ],
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
        "DELETE /projects/p1/folders/f1",
        (z) => z.folders.delete("p1", "f1", { assets: "keep" }),
        "/projects/p1/folders/f1?assets=keep",
      ],
      [
        "POST /projects/p1/folders/restore",
        (z) => z.folders.restore("p1", { eventId: "e1" }),
        "/projects/p1/folders/restore",
        { eventId: "e1" },
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
      expect(calls[0]?.headers["idempotency-key"] !== undefined, name).toBe(
        method === "POST" || method === "DELETE",
      );
    }
  });

  it("deletes a folder on one key across retries, and restores it by its eventId", async () => {
    const deletion: FolderDelete = {
      folderId: "f1",
      eventId: "e1",
      undoUntil: "2026-11-03T01:00:00.000Z",
    };
    const restored: FolderRestore = { rootId: "f1", parentId: null };
    const { fetch, calls } = fakeFetch(
      apiError(503, "service_unavailable", { retryable: true, headers: { "Retry-After": "0" } }),
      json(deletion),
      json(restored),
    );
    const zerogen = client(fetch);
    const { eventId } = await zerogen.folders.delete("p1", "f1", { assets: "trash" });
    expect(await zerogen.folders.restore("p1", { eventId })).toEqual(restored);
    expect(calls[0]).toMatchObject({
      method: "DELETE",
      url: `${BASE}/projects/p1/folders/f1?assets=trash`,
    });
    expect(calls[0]?.body).toBeUndefined();
    expect(calls[0]?.headers["content-type"]).toBeUndefined();
    const key = calls[0]?.headers["idempotency-key"];
    expect(key).toMatch(/^[0-9a-f-]{36}$/u);
    expect(calls[1]).toMatchObject({ method: "DELETE", url: calls[0]?.url });
    expect(calls[1]?.headers["idempotency-key"]).toBe(key);
    expect(calls[2]?.headers["idempotency-key"]).not.toBe(key);
    expect(JSON.parse(calls[2]?.body as string)).toEqual({ eventId: "e1" });
  });

  it("encodes IDs into the path", async () => {
    const { fetch, calls } = fakeFetch(json({}));
    await client(fetch).folders.update("p/1", "f 1", { name: "Selects" });
    expect(calls[0]?.url).toBe(`${BASE}/projects/p%2F1/folders/f%201`);
  });

  it("ensurePath finds or creates each folder of a path in turn", async () => {
    const { fetch, calls } = fakeFetch(
      json({ id: "f1", parentId: null, name: "Shots" }),
      json({ id: "f2", parentId: "f1", name: "anim" }, 201),
    );
    const folder = await client(fetch).folders.ensurePath("p1", "/Shots//anim/");
    expect(folder).toMatchObject({ id: "f2", parentId: "f1" });
    expect(calls.map((call) => [call.url, JSON.parse(call.body as string)])).toEqual([
      [`${BASE}/projects/p1/folders`, { name: "Shots", parentId: null, reuseExisting: true }],
      [`${BASE}/projects/p1/folders`, { name: "anim", parentId: "f1", reuseExisting: true }],
    ]);
    expect(new Set(calls.map((call) => call.headers["idempotency-key"])).size).toBe(2);
  });

  it("ensurePath takes names that contain a slash as an array, under parentId", async () => {
    const { fetch, calls } = fakeFetch(json({ id: "f2", parentId: "f0", name: "2026/11/01" }));
    await client(fetch).folders.ensurePath("p1", ["2026/11/01"], { parentId: "f0" });
    expect(JSON.parse(calls[0]?.body as string)).toEqual({
      name: "2026/11/01",
      parentId: "f0",
      reuseExisting: true,
    });
  });

  it("ensurePath gives each level its own key, even from options that carry one", async () => {
    const { fetch, calls } = fakeFetch(
      json({ id: "f1", parentId: null, name: "Shots" }),
      json({ id: "f2", parentId: "f1", name: "anim" }),
    );
    const shared: RequestOptions = { idempotencyKey: "shared-key", timeout: 5_000 };
    await client(fetch).folders.ensurePath("p1", "Shots/anim", shared);
    const keys = calls.map((call) => call.headers["idempotency-key"]);
    expect(keys).not.toContain("shared-key");
    expect(new Set(keys).size).toBe(2);
  });

  it("ensurePath refuses a path with no folder names before sending anything", async () => {
    const { fetch, calls } = fakeFetch();
    for (const empty of ["", "/", []])
      await expect(client(fetch).folders.ensurePath("p1", empty)).rejects.toThrow(TypeError);
    expect(calls).toEqual([]);
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

const asset = (id: string, fields: Partial<Asset> = {}): Asset => ({
  id,
  projectId: "p1",
  name: "Lighthouse",
  type: "image",
  origin: "generated",
  mimeType: "image/png",
  sizeBytes: 5,
  width: 1024,
  height: 1024,
  durationMs: null,
  favorite: false,
  labels: [],
  runId: "r1",
  outputIndex: 0,
  createdBy: { id: "u1", name: "Ana" },
  createdVia: "api",
  declared: null,
  createdAt: "2026-10-27T00:00:00.000Z",
  webUrl: "https://studio.example.com/library/a1",
  preview: null,
  ...fields,
});

describe("who made an asset", () => {
  it("reads who made each asset, where, and its link, or null when there's none", async () => {
    const { fetch } = fakeFetch(
      json({
        data: [asset("a1"), asset("a2", { createdBy: null, createdVia: null, webUrl: null })],
        nextCursor: null,
      }),
    );
    const page = await client(fetch).assets.search();
    const creators: (Creator | null)[] = page.data.map((listed) => listed.createdBy);
    expect(creators).toEqual([{ id: "u1", name: "Ana" }, null]);
    expect(page.data.map((listed) => listed.createdVia)).toEqual(["api", null]);
    expect(page.data.map((listed) => listed.webUrl)).toEqual([
      "https://studio.example.com/library/a1",
      null,
    ]);
  });

  it("filters assets by who made them", async () => {
    const { fetch, calls } = fakeFetch(json({ data: [], nextCursor: null }));
    await client(fetch).assets.search({ createdBy: ["u1", "u2"] });
    expect(calls[0]?.url).toBe(`${BASE}/assets?createdBy=u1&createdBy=u2`);
  });
});

describe("asset previews", () => {
  const preview: AssetPreview = {
    image96Url: "https://storage.example.com/a1-96.webp?X-Amz-Signature=s96",
    image512Url: "https://storage.example.com/a1-512.webp?X-Amz-Signature=s512",
    videoUrl: null,
    expiresAt: "2026-10-27T00:05:00.000Z",
  };

  it("reads each listed asset's preview, or null before it's made", async () => {
    const { fetch } = fakeFetch(
      json({ data: [asset("a1", { preview }), asset("a2")], nextCursor: null }),
    );
    const previews: (AssetPreview | null)[] = [];
    for await (const listed of client(fetch).assets.search({ projectId: "p1" }))
      previews.push(listed.preview);
    expect(previews).toEqual([preview, null]);
  });

  it("reads one asset's preview", async () => {
    const detail: AssetDetail = {
      ...asset("a1", { preview }),
      prompt: "A lighthouse at dawn",
      promptTruncated: false,
    };
    const { fetch } = fakeFetch(json(detail));
    const read = await client(fetch).assets.get("a1");
    expect(read.preview?.image512Url).toBe(preview.image512Url);
  });
});

describe("declared provenance", () => {
  const declared: NonNullable<Asset["declared"]> = {
    tool: {
      name: "comfyui",
      version: "0.3.40",
      integration: { name: "zerogen-nodes", version: "0.1.0" },
      models: ["flux1-dev.safetensors"],
    },
    externalRef: { system: "comfyui", id: "prompt-1" },
    occurredAt: "2026-11-01T00:00:00.000Z",
  };
  const workflow = { nodes: [{ id: 1, type: "KSampler" }] };

  it("reads what was declared about each asset, or null", async () => {
    const { fetch } = fakeFetch(
      json({
        data: [asset("a1", { origin: "upload", declared }), asset("a2")],
        nextCursor: null,
      }),
    );
    const page = await client(fetch).assets.search();
    expect(page.data.map((listed) => listed.declared?.tool.name ?? null)).toEqual([
      "comfyui",
      null,
    ]);
  });

  it("reads a declared workflow only when asked", async () => {
    const detail: AssetDetail = {
      ...asset("a1", { origin: "upload", declared }),
      prompt: "A lighthouse at dawn",
      promptTruncated: false,
      workflow,
    };
    const { fetch, calls } = fakeFetch(json(detail));
    const read = await client(fetch).assets.get("a1", {
      includeWorkflow: true,
      headers: { "X-Trace": "t1" },
    });
    expect(read.workflow).toEqual(workflow);
    expect(read.declared?.externalRef).toEqual({ system: "comfyui", id: "prompt-1" });
    expect(calls[0]).toMatchObject({
      url: `${BASE}/assets/a1?includeWorkflow=true`,
      headers: { "x-trace": "t1" },
    });
  });

  it("marks declared lineage edges", async () => {
    const edges: Lineage["edges"] = [
      { assetId: "a1", sourceAssetId: "a0", role: "source", kind: null, declared: true },
    ];
    const { fetch } = fakeFetch(
      json({
        asset: null,
        sources: [],
        uses: [],
        edges,
        truncated: { sources: false, uses: false },
      }),
    );
    const lineage = await client(fetch).assets.lineage("a1");
    expect(lineage.edges[0]?.declared).toBe(true);
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
