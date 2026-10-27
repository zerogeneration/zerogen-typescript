import type { components, operations } from "./openapi.js";

type Schemas = components["schemas"];
type Query<Operation extends keyof operations> = NonNullable<
  operations[Operation]["parameters"]["query"]
>;

export type Me = Schemas["Me"];
export type Balance = Schemas["Balance"];
export type Model = Schemas["Model"];
export type ModelDetail = Schemas["ModelDetail"];
export type CreateRunRequest = Schemas["CreateRunRequest"];
export type Quote = Schemas["Quote"];
export type Run = Schemas["Run"];
export type CreateUploadRequest = Schemas["CreateUploadRequest"];
export type Upload = Schemas["Upload"];
export type Project = Schemas["Project"];
export type Asset = Schemas["Asset"];
export type AssetDetail = Schemas["AssetDetail"];
export type AssetPreview = Schemas["AssetPreview"];
export type UpdateAssetRequest = Schemas["UpdateAssetRequest"];
export type AssetChange = Schemas["AssetChange"];
export type Lineage = Schemas["Lineage"];
export type LineageAsset = Schemas["LineageAsset"];
export type AssetDownload = Schemas["AssetDownload"];
export type AssetFolders = Schemas["AssetFolders"];
export type Folder = Schemas["Folder"];
export type CreateFolderRequest = Schemas["CreateFolderRequest"];
export type UpdateFolderRequest = Schemas["UpdateFolderRequest"];
export type FolderAssetsRequest = Schemas["FolderAssetsRequest"];
export type MoveAssetsRequest = Schemas["MoveAssetsRequest"];
export type FolderAssetsChange = Schemas["FolderAssetsChange"];
export type Label = Schemas["Label"];
export type CreateLabelRequest = Schemas["CreateLabelRequest"];
export type UpdateLabelRequest = Schemas["UpdateLabelRequest"];
export type LabelAssetsRequest = Schemas["LabelAssetsRequest"];
export type LabelAssetsChange = Schemas["LabelAssetsChange"];
export type NamingPreset = Schemas["NamingPreset"];
export type Skill = Schemas["Skill"];
export type SkillDetail = Schemas["SkillDetail"];
export type ApiError = Schemas["Error"];

export type BalanceQuery = Query<"getBalance">;
export type ModelListQuery = Query<"listModels">;
export type RunListQuery = Query<"listRuns">;
export type AssetSearchQuery = Omit<Query<"searchAssets">, "favorite"> & {
  /** Only the organization's favorites. */
  favorite?: boolean;
};
export type FolderListQuery = Query<"listFolders">;
export type LabelListQuery = Omit<Query<"listLabels">, "includeArchived"> & {
  /** Also list archived labels; owners and admins only. */
  includeArchived?: boolean;
};
export type NamingPresetListQuery = Query<"listNamingPresets">;
export type SkillListQuery = Query<"listSkills">;
export type SkillGetQuery = Query<"getSkill">;

export type { components, operations, paths } from "./openapi.js";
