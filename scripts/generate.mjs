import { readFile, writeFile } from "node:fs/promises";
import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";

// openapi-typescript reads an anyOf whose members only constrain which
// properties are present, such as CreateUploadRequest's "a declaration needs
// tool", as unknown, which erases the whole type. The API enforces those
// rules, so the types leave them out.
const CONSTRAINT_KEYS = new Set(["required", "not", "description"]);

function constrainsOnly(schema) {
  return (
    schema !== null &&
    typeof schema === "object" &&
    Object.keys(schema).every((key) => CONSTRAINT_KEYS.has(key))
  );
}

function typeable(node) {
  if (Array.isArray(node)) return node.map(typeable);
  if (node === null || typeof node !== "object") return node;
  const result = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "anyOf" && Array.isArray(value) && value.every(constrainsOnly)) continue;
    result[key] = typeable(value);
  }
  return result;
}

const spec = JSON.parse(await readFile("openapi.json", "utf8"));
await writeFile("src/openapi.ts", COMMENT_HEADER + astToString(await openapiTS(typeable(spec))));
console.log("Wrote src/openapi.ts from openapi.json");
