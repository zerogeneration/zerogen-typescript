import type { components, operations } from "./openapi.js";

type Schemas = components["schemas"];
type Query<Operation extends keyof operations> = NonNullable<
  operations[Operation]["parameters"]["query"]
>;

export type Me = Schemas["Me"];
export type Balance = Schemas["Balance"];
export type Model = Schemas["Model"];
export type ModelDetail = Schemas["ModelDetail"];
export type CreateGenerationRequest = Schemas["CreateGenerationRequest"];
export type Quote = Schemas["Quote"];
export type Generation = Schemas["Generation"];
export type CreateUploadRequest = Schemas["CreateUploadRequest"];
export type Upload = Schemas["Upload"];
export type ApiError = Schemas["Error"];

export type BalanceQuery = Query<"getBalance">;
export type ModelListQuery = Query<"listModels">;
export type GenerationListQuery = Query<"listGenerations">;

export type { components, operations, paths } from "./openapi.js";
