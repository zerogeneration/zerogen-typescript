import { writeFile } from "node:fs/promises";

const url = process.env.ZEROGEN_OPENAPI_URL ?? "https://api.zerogen.com/v1/openapi.json";
const response = await fetch(url);
if (!response.ok) throw new Error(`GET ${url} answered ${response.status}`);
await writeFile("openapi.json", `${JSON.stringify(await response.json(), null, 2)}\n`);
console.log(`Wrote openapi.json from ${url}`);
