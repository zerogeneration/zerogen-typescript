import { describe, expect, it } from "vitest";
import ZeroGen from "../src/index.js";
import { fakeFetch, json } from "./fake-fetch.js";

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
    expect(JSON.parse(calls[0]?.body as string)).toMatchObject({
      filename: "clip.mov",
      contentType: "video/quicktime",
    });
    expect(calls).toHaveLength(1);
  });

  it("needs a name and a type it can send", async () => {
    const zerogen = client(fakeFetch().fetch);
    await expect(zerogen.uploads.upload(bytes)).rejects.toThrow(/filename/u);
    await expect(zerogen.uploads.upload(bytes, { filename: "notes.txt" })).rejects.toThrow(
      /contentType/u,
    );
  });
});
