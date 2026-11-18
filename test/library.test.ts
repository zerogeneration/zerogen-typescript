import { describe, expect, expectTypeOf, it } from "vitest";
import ZeroGen, {
  type Asset,
  type AssetDetail,
  type AssetPreview,
  type AudioRecipe,
  type CreateNamingPresetRequest,
  type Creator,
  type FolderDelete,
  type FolderRestore,
  type FrameRecipe,
  type ImageRecipe,
  type LineageAsset,
  type RequestOptions,
  type TransformRecipe,
  type VideoRecipe,
  ZeroGenError,
} from "../src/index.js";
import { apiError, fakeFetch, json } from "./fake-fetch.js";

const client = (fetch: ReturnType<typeof fakeFetch>["fetch"]) =>
  new ZeroGen({ apiKey: "zg_test_key", fetch, defaultHeaders: { "X-Team": "studio" } });

const BASE = "https://api.zerogen.com/v1";
const assetIds = ["a1", "a2"];
const namingPreset: CreateNamingPresetRequest = {
  projectId: "p1",
  name: "Shots",
  definition: {
    delimiter: "_",
    fields: [
      {
        id: "shot",
        kind: "shot",
        label: "Shot",
        prefix: "SH",
        padding: 3,
        step: 10,
        sequence: "number",
        artistFormat: "initials",
        dateFormat: "YYYYMMDD",
        defaultValue: "",
      },
    ],
  },
};

describe("Library", () => {
  it("sends each method to its route", async () => {
    const cases: [string, (z: ZeroGen) => PromiseLike<unknown>, string, unknown?][] = [
      ["GET /projects", (z) => z.projects.list(), "/projects"],
      ["GET /projects?limit=100", (z) => z.projects.list({ limit: 100 }), "/projects?limit=100"],
      ["GET /projects/p1", (z) => z.projects.get("p1"), "/projects/p1"],
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
      ["GET /assets/a1/sources", (z) => z.assets.sources("a1"), "/assets/a1/sources"],
      [
        "GET /assets/a1/uses?limit=100",
        (z) => z.assets.uses("a1", { limit: 100 }),
        "/assets/a1/uses?limit=100",
      ],
      ["GET /assets/a1/folders", (z) => z.assets.folders("a1"), "/assets/a1/folders"],
      ["GET /assets/a1/download", (z) => z.assets.getDownload("a1"), "/assets/a1/download"],
      [
        "PATCH /assets/a1",
        (z) => z.assets.update("a1", { favorite: true }),
        "/assets/a1",
        { favorite: true },
      ],
      ["DELETE /assets/a1", (z) => z.assets.delete("a1"), "/assets/a1"],
      ["POST /assets/a1/restore", (z) => z.assets.restore("a1"), "/assets/a1/restore"],
      [
        "POST /assets/a1/transform",
        (z) => z.assets.transform("a1", { recipe: { extractFrame: { timeSeconds: 2 } } }),
        "/assets/a1/transform",
        { recipe: { extractFrame: { timeSeconds: 2 } } },
      ],
      ["GET /luts", (z) => z.luts.list({ limit: 100 }), "/luts?limit=100"],
      [
        "GET /folders?projectId=p1",
        (z) => z.folders.list("p1", { limit: 100 }),
        "/folders?limit=100&projectId=p1",
      ],
      ["GET /folders/f1", (z) => z.folders.get("f1"), "/folders/f1"],
      [
        "POST /folders",
        (z) => z.folders.create({ projectId: "p1", name: "Selects" }),
        "/folders",
        { projectId: "p1", name: "Selects" },
      ],
      [
        "PATCH /folders/f1",
        (z) => z.folders.update("f1", { parentId: null }),
        "/folders/f1",
        { parentId: null },
      ],
      [
        "DELETE /folders/f1",
        (z) => z.folders.delete("f1", { assets: "keep" }),
        "/folders/f1?assets=keep",
      ],
      [
        "POST /folders/restore",
        (z) => z.folders.restore({ eventId: "e1" }),
        "/folders/restore",
        { eventId: "e1" },
      ],
      [
        "POST /folders/f1/assets",
        (z) => z.folders.addAssets("f1", { assetIds }),
        "/folders/f1/assets",
        { assetIds },
      ],
      [
        "POST /folders/f1/assets/move",
        (z) => z.folders.moveAssets("f1", { assetIds, fromFolderId: "f0" }),
        "/folders/f1/assets/move",
        { assetIds, fromFolderId: "f0" },
      ],
      [
        "POST /folders/f1/assets/remove",
        (z) => z.folders.removeAssets("f1", { assetIds }),
        "/folders/f1/assets/remove",
        { assetIds },
      ],
      [
        "GET /labels",
        (z) => z.labels.list({ includeArchived: false }),
        "/labels?includeArchived=false",
      ],
      ["GET /labels/l1", (z) => z.labels.get("l1"), "/labels/l1"],
      ["POST /labels", (z) => z.labels.create({ name: "Hero" }), "/labels", { name: "Hero" }],
      [
        "PATCH /labels/l1",
        (z) => z.labels.update("l1", { color: "#3b82f6" }),
        "/labels/l1",
        { color: "#3b82f6" },
      ],
      ["POST /labels/l1/archive", (z) => z.labels.archive("l1"), "/labels/l1/archive"],
      ["POST /labels/l1/restore", (z) => z.labels.restore("l1"), "/labels/l1/restore"],
      [
        "POST /labels/l1/assets",
        (z) => z.labels.addAssets("l1", { assetIds }),
        "/labels/l1/assets",
        { assetIds },
      ],
      [
        "POST /labels/l1/assets/remove",
        (z) => z.labels.removeAssets("l1", { assetIds }),
        "/labels/l1/assets/remove",
        { assetIds },
      ],
      [
        "GET /naming-presets?projectId=p1",
        (z) => z.namingPresets.list("p1"),
        "/naming-presets?projectId=p1",
      ],
      [
        "POST /naming-presets",
        (z) => z.namingPresets.create(namingPreset),
        "/naming-presets",
        namingPreset,
      ],
      ["GET /skills", (z) => z.skills.list({ projectId: "p1" }), "/skills?projectId=p1"],
      ["GET /skills/s1", (z) => z.skills.get("s1", { projectId: "p1" }), "/skills/s1?projectId=p1"],
      [
        "GET /attachments?projectId=p1",
        (z) => z.attachments.list("p1", { folderId: "f1" }),
        "/attachments?folderId=f1&projectId=p1",
      ],
      [
        "POST /attachments",
        (z) => z.attachments.create({ projectId: "p1", title: "Brief", body: "Moody" }),
        "/attachments",
        { projectId: "p1", title: "Brief", body: "Moody" },
      ],
      [
        "GET /attachments/t1?version=2",
        (z) => z.attachments.get("t1", { version: 2 }),
        "/attachments/t1?version=2",
      ],
      [
        "PATCH /attachments/t1",
        (z) => z.attachments.revise("t1", { expectedVersion: 2, body: "Brighter" }),
        "/attachments/t1",
        { expectedVersion: 2, body: "Brighter" },
      ],
      [
        "DELETE /attachments/t1",
        (z) => z.attachments.delete("t1", { expectedVersion: 3 }),
        "/attachments/t1?expectedVersion=3",
      ],
      [
        "POST /attachments/t1/restore",
        (z) => z.attachments.restore("t1", { version: 1, expectedVersion: 4 }),
        "/attachments/t1/restore",
        { version: 1, expectedVersion: 4 },
      ],
      [
        "GET /attachments/t1/versions",
        (z) => z.attachments.versions("t1"),
        "/attachments/t1/versions",
      ],
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
      expect(calls[0]?.headers["idempotency-key"] !== undefined, name).toBe(method !== "GET");
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
    const { eventId } = await zerogen.folders.delete("f1", { assets: "trash" });
    expect(await zerogen.folders.restore({ eventId })).toEqual(restored);
    expect(calls[0]).toMatchObject({ method: "DELETE", url: `${BASE}/folders/f1?assets=trash` });
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
    await client(fetch).folders.update("f/1 2", { name: "Selects" });
    expect(calls[0]?.url).toBe(`${BASE}/folders/f%2F1%202`);
  });

  it("ensurePath finds or creates each folder of a path in turn", async () => {
    const { fetch, calls } = fakeFetch(
      json({ id: "f1", parentId: null, name: "Shots" }),
      json({ id: "f2", parentId: "f1", name: "anim" }, 201),
    );
    const folder = await client(fetch).folders.ensurePath("p1", "/Shots//anim/");
    expect(folder).toMatchObject({ id: "f2", parentId: "f1" });
    expect(calls.map((call) => [call.url, JSON.parse(call.body as string)])).toEqual([
      [`${BASE}/folders`, { projectId: "p1", name: "Shots", parentId: null, reuseExisting: true }],
      [`${BASE}/folders`, { projectId: "p1", name: "anim", parentId: "f1", reuseExisting: true }],
    ]);
    expect(new Set(calls.map((call) => call.headers["idempotency-key"])).size).toBe(2);
  });

  it("ensurePath takes names that contain a slash as an array, under parentId", async () => {
    const { fetch, calls } = fakeFetch(json({ id: "f2", parentId: "f0", name: "2026/11/01" }));
    await client(fetch).folders.ensurePath("p1", ["2026/11/01"], { parentId: "f0" });
    expect(JSON.parse(calls[0]?.body as string)).toEqual({
      projectId: "p1",
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
    const source: LineageAsset = {
      assetId: "a0",
      depth: 1,
      found: true,
      deleted: false,
      name: "Plate",
      origin: "upload",
      mimeType: "image/png",
      runId: null,
      prompt: null,
      edges: [{ assetId: "a1", sourceAssetId: "a0", role: "source", kind: null, declared: true }],
    };
    const { fetch } = fakeFetch(json({ data: [source], nextCursor: null }));
    const page = await client(fetch).assets.sources("a1");
    expect(page.data[0]?.edges[0]?.declared).toBe(true);
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

describe("Library lists", () => {
  it("reads every page of every list, with the same filters", async () => {
    const lists: [string, (z: ZeroGen) => AsyncIterable<unknown>][] = [
      ["/projects?limit=1", (z) => z.projects.list({ limit: 1 })],
      ["/assets/a1/sources?limit=1", (z) => z.assets.sources("a1", { limit: 1 })],
      ["/assets/a1/uses?limit=1", (z) => z.assets.uses("a1", { limit: 1 })],
      ["/assets/a1/folders?limit=1", (z) => z.assets.folders("a1", { limit: 1 })],
      ["/luts?limit=1", (z) => z.luts.list({ limit: 1 })],
      ["/folders?limit=1&projectId=p1", (z) => z.folders.list("p1", { limit: 1 })],
      ["/naming-presets?limit=1&projectId=p1", (z) => z.namingPresets.list("p1", { limit: 1 })],
      ["/labels?limit=1", (z) => z.labels.list({ limit: 1 })],
      [
        "/attachments?clipId=c1&limit=1&projectId=p1",
        (z) => z.attachments.list("p1", { clipId: "c1", limit: 1 }),
      ],
      ["/attachments/t1/versions?limit=1", (z) => z.attachments.versions("t1", { limit: 1 })],
    ];
    for (const [path, list] of lists) {
      const { fetch, calls } = fakeFetch(
        json({ data: [{ id: "1" }], nextCursor: "c2" }),
        json({ data: [{ id: "2" }], nextCursor: null }),
      );
      const ids: string[] = [];
      for await (const item of list(client(fetch))) ids.push((item as { id: string }).id);
      expect(ids, path).toEqual(["1", "2"]);
      expect(
        calls.map((call) => call.url),
        path,
      ).toEqual([BASE + path, `${BASE}${path}&cursor=c2`]);
    }
  });
});

describe("transforms", () => {
  const recipe: TransformRecipe = {
    trim: { startSeconds: 2, endSeconds: 8 },
    lut: { lutId: "1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b", strength: 80 },
  };

  it("transformAndWait holds the transform, then follows its run until it ends", async () => {
    const { fetch, calls } = fakeFetch(
      json({ id: "r1", kind: "transform", status: "running", endedAt: null, reused: false }, 202),
      json({ id: "r1", kind: "transform", status: "succeeded", endedAt: "2026-11-18T00:00:00Z" }),
    );
    const run = await client(fetch).assets.transformAndWait("a1", { recipe, projectId: "p2" });
    expect(run).toMatchObject({ id: "r1", status: "succeeded", reused: false });
    expect(calls.map((call) => `${call.method} ${call.url} ${call.headers.prefer}`)).toEqual([
      `POST ${BASE}/assets/a1/transform wait=60`,
      `GET ${BASE}/runs/r1 wait=60`,
    ]);
    expect(JSON.parse(calls[0]?.body as string)).toEqual({ recipe, projectId: "p2" });
    expect(calls[1]?.headers["idempotency-key"]).toBeUndefined();
  });

  it("transformAndWait returns earlier work that already ended", async () => {
    const { fetch, calls } = fakeFetch(
      json({ id: "r0", status: "succeeded", endedAt: "2026-11-17T00:00:00Z", reused: true }),
    );
    const run = await client(fetch).assets.transformAndWait("a1", { recipe });
    expect(run.reused).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("names each recipe form by its steps", () => {
    expectTypeOf<FrameRecipe>().not.toBeNever();
    expectTypeOf<ImageRecipe>().not.toBeNever();
    expectTypeOf<VideoRecipe>().not.toBeNever();
    expectTypeOf<AudioRecipe>().not.toBeNever();
    expectTypeOf<FrameRecipe>().toHaveProperty("extractFrame");
    expectTypeOf<VideoRecipe>().toHaveProperty("frameRate");
    expectTypeOf<ImageRecipe>().toHaveProperty("crop");
    expectTypeOf<AudioRecipe>().toHaveProperty("trim");
    expectTypeOf<
      FrameRecipe | ImageRecipe | VideoRecipe | AudioRecipe
    >().toEqualTypeOf<TransformRecipe>();
    expectTypeOf<{ convert: { format: "mp3" } }>().toExtend<AudioRecipe>();
    expectTypeOf<{ convert: { format: "png" } }>().toExtend<ImageRecipe>();
    expectTypeOf<{ convert: { format: "mp4" } }>().toExtend<VideoRecipe>();
    expectTypeOf<{ convert: { format: "mp3" } }>().not.toExtend<ImageRecipe>();
  });
});
