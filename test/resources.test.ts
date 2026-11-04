import { describe, expect, it } from "vitest";
import ZeroGen, {
  type AssetPreview,
  type CreateUploadRequest,
  type Creator,
  type DeclareUploadRequest,
  type Run,
} from "../src/index.js";
import { apiError, fakeFetch, json } from "./fake-fetch.js";

const client = (fetch: ReturnType<typeof fakeFetch>["fetch"]) =>
  new ZeroGen({ apiKey: "zg_test_key", fetch });

describe("runs", () => {
  it("createAndWait holds the create, then waits on the run until it ends", async () => {
    const { fetch, calls } = fakeFetch(
      json({ id: "r1", status: "running" }, 202),
      json({ id: "r1", status: "running" }),
      json({ id: "r1", status: "succeeded", outputs: [] }),
    );
    const run = await client(fetch).runs.createAndWait({
      model: "openai/gpt-image-2/generate",
      prompt: "A lighthouse at dawn",
    });
    expect(run.status).toBe("succeeded");
    expect(calls.map((call) => `${call.method} ${call.url} ${call.headers.prefer}`)).toEqual([
      "POST https://api.zerogen.com/v1/runs wait=60",
      "GET https://api.zerogen.com/v1/runs/r1 wait=60",
      "GET https://api.zerogen.com/v1/runs/r1 wait=60",
    ]);
    expect(JSON.parse(calls[0]?.body as string)).toEqual({
      model: "openai/gpt-image-2/generate",
      prompt: "A lighthouse at dawn",
    });
  });

  it("createAndWait returns a run that ended within the create", async () => {
    const { fetch, calls } = fakeFetch(json({ id: "r1", status: "failed", error: {} }));
    const run = await client(fetch).runs.createAndWait({ model: "a/b/generate" });
    expect(run.status).toBe("failed");
    expect(calls).toHaveLength(1);
  });

  it("lists every page with the same filters", async () => {
    const { fetch, calls } = fakeFetch(
      json({ data: [{ id: "r1" }, { id: "r2" }], nextCursor: "c2" }),
      json({ data: [{ id: "r3" }], nextCursor: null }),
    );
    const ids: string[] = [];
    for await (const run of client(fetch).runs.list({ projectId: "p1", limit: 2 }))
      ids.push(run.id);
    expect(ids).toEqual(["r1", "r2", "r3"]);
    expect(calls.map((call) => call.url)).toEqual([
      "https://api.zerogen.com/v1/runs?projectId=p1&limit=2",
      "https://api.zerogen.com/v1/runs?projectId=p1&limit=2&cursor=c2",
    ]);
  });

  it("reads each output's preview, or null before it's made", async () => {
    const preview: AssetPreview = {
      image96Url: "https://storage.example.com/a0-96.webp?X-Amz-Signature=s96",
      image512Url: "https://storage.example.com/a0-512.webp?X-Amz-Signature=s512",
      videoUrl: "https://storage.example.com/a0.webm?X-Amz-Signature=sv",
      expiresAt: "2026-10-27T00:05:00.000Z",
    };
    const output = (index: number, assetPreview: AssetPreview | null): Run["outputs"][number] => ({
      index,
      status: "succeeded",
      asset: {
        id: `a${index}`,
        mimeType: "video/mp4",
        width: 1280,
        height: 720,
        durationMs: 8000,
        preview: assetPreview,
      },
      error: null,
    });
    const { fetch } = fakeFetch(
      json({ id: "r1", status: "succeeded", outputs: [output(0, preview), output(1, null)] }),
    );
    const run = await client(fetch).runs.get("r1");
    const previews: (AssetPreview | null)[] = run.outputs.map(({ asset }) =>
      asset ? asset.preview : null,
    );
    expect(previews).toEqual([preview, null]);
    expect(run.outputs[0]?.asset?.preview?.videoUrl).toBe(preview.videoUrl);
  });

  it("sends a seed and labels with a run, and upscales a Draft output", async () => {
    const { fetch, calls } = fakeFetch(
      json({ id: "r1", status: "queued" }, 202),
      json({ id: "r2", status: "queued" }, 202),
    );
    const zerogen = client(fetch);
    await zerogen.runs.create({
      model: "a/b/generate",
      prompt: "A lighthouse at dawn",
      seed: 7,
      labelIds: ["l1"],
    });
    await zerogen.runs.create({
      model: "a/b/generate",
      upscaleDraft: { runId: "r1", outputIndex: 0, resolution: "1080p" },
    });
    expect(calls.map((call) => JSON.parse(call.body as string))).toEqual([
      { model: "a/b/generate", prompt: "A lighthouse at dawn", seed: 7, labelIds: ["l1"] },
      {
        model: "a/b/generate",
        upscaleDraft: { runId: "r1", outputIndex: 0, resolution: "1080p" },
      },
    ]);
  });

  it("reads who made a run, where, and its link", async () => {
    const made: Pick<Run, "createdBy" | "createdVia" | "webUrl"> = {
      createdBy: { id: "u1", name: null },
      createdVia: "agent",
      webUrl: "https://studio.example.com/generate/r1",
    };
    const { fetch } = fakeFetch(json({ id: "r1", status: "succeeded", outputs: [], ...made }));
    const run = await client(fetch).runs.get("r1");
    const creator: Creator | null = run.createdBy;
    expect(creator).toEqual(made.createdBy);
    expect(run.createdVia).toBe("agent");
    expect(run.webUrl).toBe(made.webUrl);
  });

  it("awaits a list as its first page", async () => {
    const { fetch, calls } = fakeFetch(json({ data: [{ id: "m1" }], nextCursor: "c2" }));
    const page = await client(fetch).models.list({ capability: "video" });
    expect(page.data).toHaveLength(1);
    expect(page.hasNextPage()).toBe(true);
    expect(calls).toHaveLength(1);
  });
});

describe("uploads", () => {
  const bytes = new TextEncoder().encode("hello");
  const helloSha256 = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

  it("sends the bytes to the upload target without the API key, then completes", async () => {
    const { fetch, calls } = fakeFetch(
      json(
        {
          id: "u1",
          status: "upload_required",
          assetId: null,
          upload: {
            method: "PUT",
            url: "https://storage.example.com/u1",
            headers: { "Content-Type": "image/png" },
            expiresAt: "2026-10-25T00:00:00.000Z",
          },
        },
        201,
      ),
      new Response(null, { status: 200 }),
      json({ id: "u1", status: "ready", assetId: "a1", upload: null }),
    );
    const upload = await client(fetch).uploads.upload(bytes, {
      filename: "shot.PNG",
      projectId: "p1",
    });
    const assetId: string = upload.assetId;
    expect(assetId).toBe("a1");
    expect(JSON.parse(calls[0]?.body as string)).toEqual({
      filename: "shot.PNG",
      contentType: "image/png",
      sizeBytes: 5,
      sha256: helloSha256,
      projectId: "p1",
    });
    expect(calls[1]).toMatchObject({
      method: "PUT",
      url: "https://storage.example.com/u1",
      headers: { "content-type": "image/png" },
    });
    expect(calls[1]?.headers.authorization).toBeUndefined();
    expect(calls[2]?.url).toBe("https://api.zerogen.com/v1/uploads/u1/complete");
  });

  it("reuses an identical file the project already has", async () => {
    const { fetch, calls } = fakeFetch(
      json({ id: "u1", status: "ready", assetId: "a0", upload: null }),
    );
    const file = new File([bytes], "clip.mov");
    const upload = await client(fetch).uploads.upload(file);
    expect(upload.assetId).toBe("a0");
    expect(upload.declarationRecorded).toBe(false);
    expect(JSON.parse(calls[0]?.body as string)).toMatchObject({
      filename: "clip.mov",
      contentType: "video/quicktime",
    });
    expect(calls).toHaveLength(1);
  });

  describe("with a declaration", () => {
    const declaration: DeclareUploadRequest = {
      tool: { name: "comfyui", integration: { name: "zerogen-nodes", version: "0.1.0" } },
      sources: [{ asset: "s1", role: "reference" }],
      prompt: "A lighthouse at dawn",
      workflow: { nodes: [] },
      externalRef: { system: "comfyui", id: "prompt-1" },
    };
    const naming: CreateUploadRequest["naming"] = {
      presetId: null,
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
      values: { shot: 10 },
    };
    const ready = (assetId: string, runId: string | null) =>
      json({ id: "u1", projectId: "p1", runId, status: "ready", assetId, upload: null });
    const pending = () =>
      json(
        {
          id: "u1",
          projectId: "p1",
          runId: "r1",
          status: "upload_required",
          assetId: null,
          upload: { method: "PUT", url: "https://storage.example.com/u1", headers: {} },
        },
        201,
      );

    it("sends it with the upload, which records it as the asset's run", async () => {
      const { fetch, calls } = fakeFetch(pending(), new Response(null), ready("u1", "r1"));
      const upload = await client(fetch).uploads.upload(bytes, {
        filename: "shot.png",
        declaration,
        naming,
      });
      expect(upload).toMatchObject({ assetId: "u1", runId: "r1", declarationRecorded: true });
      expect(JSON.parse(calls[0]?.body as string)).toEqual({
        filename: "shot.png",
        contentType: "image/png",
        sizeBytes: 5,
        sha256: helloSha256,
        ...declaration,
        naming,
      });
      expect(calls).toHaveLength(3);
    });

    it("declares an identical file the project already has", async () => {
      const { fetch, calls } = fakeFetch(
        ready("a0", null),
        json({ assetId: "a0", runId: "r2", asset: { id: "a0" } }),
      );
      const upload = await client(fetch).uploads.upload(bytes, {
        filename: "shot.png",
        declaration,
        naming,
      });
      expect(upload).toMatchObject({ assetId: "a0", runId: null, declarationRecorded: true });
      expect(calls[1]).toMatchObject({
        method: "POST",
        url: "https://api.zerogen.com/v1/assets/a0/declaration",
      });
      expect(JSON.parse(calls[1]?.body as string)).toEqual(declaration);
      expect(calls[1]?.headers["idempotency-key"]).toBeDefined();
    });

    it("declares the identical file that completing reused", async () => {
      const { fetch, calls } = fakeFetch(
        pending(),
        new Response(null),
        ready("a0", null),
        json({ assetId: "a0", runId: "r2", asset: { id: "a0" } }),
      );
      const upload = await client(fetch).uploads.upload(bytes, {
        filename: "shot.png",
        declaration,
      });
      expect(upload).toMatchObject({ assetId: "a0", runId: null, declarationRecorded: true });
      expect(calls[3]?.url).toBe("https://api.zerogen.com/v1/assets/a0/declaration");
    });

    it("keeps an identical file that can't take the declaration", async () => {
      for (const [status, code, param] of [
        [409, "invalid_state", undefined],
        [403, "permission_denied", undefined],
        [400, "validation_failed", "sources"],
      ] as const) {
        const { fetch } = fakeFetch(ready("a0", null), apiError(status, code, { param }));
        const upload = await client(fetch).uploads.upload(bytes, {
          filename: "shot.png",
          declaration,
        });
        expect(upload, code).toMatchObject({
          assetId: "a0",
          runId: null,
          declarationRecorded: false,
        });
      }
    });

    it("throws any other error from declaring", async () => {
      for (const [status, code, param] of [
        [404, "not_found", "sources"],
        [400, "validation_failed", "tool"],
      ] as const) {
        const { fetch } = fakeFetch(ready("a0", null), apiError(status, code, { param }));
        await expect(
          client(fetch).uploads.upload(bytes, { filename: "shot.png", declaration }),
          code,
        ).rejects.toMatchObject({ status, code, param });
      }
    });
  });

  it("needs a name and a type it can send", async () => {
    const zerogen = client(fakeFetch().fetch);
    await expect(zerogen.uploads.upload(bytes)).rejects.toThrow(/filename/u);
    await expect(zerogen.uploads.upload(bytes, { filename: "notes.txt" })).rejects.toThrow(
      /contentType/u,
    );
  });
});
