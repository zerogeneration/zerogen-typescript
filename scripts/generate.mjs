import { readFile, writeFile } from "node:fs/promises";
import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";
import ts from "typescript";

// openapi-typescript reads an anyOf whose members only constrain which
// properties are present, such as CreateUploadRequest's "a declaration needs
// tool", as unknown, which erases the whole type. The API enforces those
// rules, so the types leave them out.
const CONSTRAINT_KEYS = new Set(["required", "not", "description"]);

// Response enums are an anyOf of the known values and any other string, so a
// value added later still fits. openapi-typescript writes that as
// `"a" | "b" | string`, which TypeScript collapses to `string`; the open
// member becomes `string & {}` instead, which keeps the known values.
const OPEN = "x-zerogen-open-enum";

function constrainsOnly(schema) {
  return (
    schema !== null &&
    typeof schema === "object" &&
    Object.keys(schema).every((key) => CONSTRAINT_KEYS.has(key))
  );
}

function plainString(schema) {
  return schema?.type === "string" && Object.keys(schema).length === 1;
}

function typeable(node) {
  if (Array.isArray(node)) return node.map(typeable);
  if (node === null || typeof node !== "object") return node;
  const result = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "anyOf" && Array.isArray(value) && value.every(constrainsOnly)) continue;
    if (
      key === "anyOf" &&
      Array.isArray(value) &&
      value.some((member) => member?.enum !== undefined || member?.const !== undefined)
    ) {
      result[key] = value.map((member) =>
        plainString(member) ? { ...member, [OPEN]: true } : typeable(member),
      );
      continue;
    }
    result[key] = typeable(value);
  }
  return result;
}

const openString = ts.factory.createIntersectionTypeNode([
  ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
  ts.factory.createTypeLiteralNode([]),
]);

const spec = JSON.parse(await readFile("openapi.json", "utf8"));
const ast = await openapiTS(typeable(spec), {
  transform: (schema) => (schema[OPEN] ? openString : undefined),
});
await writeFile("src/openapi.ts", COMMENT_HEADER + astToString(ast));
console.log("Wrote src/openapi.ts from openapi.json");
