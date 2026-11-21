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
/** An input as a quote returns it: the Library asset a create would use. */
export type QuoteInput = Quote["inputs"][number];
/**
 * A create request's body, which also takes a quote's `inputs` as they come
 * back, so a create can use the assets the quote imported.
 */
export type RunCreateParams = Omit<CreateRunRequest, "inputs"> & {
  inputs?: (NonNullable<CreateRunRequest["inputs"]>[number] | QuoteInput)[];
};
export type Run = Schemas["Run"];
/** queued and running mean the run hasn't ended; read `endedAt` to tell. */
export type RunStatus = Run["status"];
export type RunKind = Run["kind"];
export type RunOutput = Run["outputs"][number];
/** What a run was asked to make, in the create request's shape. */
export type RunRequest = NonNullable<Run["request"]>;
export type CreateUploadRequest = Schemas["CreateUploadRequest"];
export type Upload = Schemas["Upload"];
export type Project = Schemas["Project"];
export type Creator = Schemas["Creator"];
export type Asset = Schemas["Asset"];
export type AssetDetail = Schemas["AssetDetail"];
export type AssetPreview = Schemas["AssetPreview"];
export type DeclareUploadRequest = Schemas["DeclareUploadRequest"];
export type AssetDeclaration = Schemas["AssetDeclaration"];
export type UpdateAssetRequest = Schemas["UpdateAssetRequest"];
export type AssetDelete = Schemas["AssetDelete"];
export type AssetBatchRequest = Schemas["AssetBatchRequest"];
export type AssetBatchChange = Schemas["AssetBatchChange"];
export type LineageAsset = Schemas["LineageAsset"];
export type LineageEdge = LineageAsset["edges"][number];
export type AssetDownload = Schemas["AssetDownload"];
export type AssetFolder = Schemas["AssetFolder"];
export type TransformAssetRequest = Schemas["TransformAssetRequest"];
/** A transform's recipe: one of its forms, chosen by the source asset. */
export type TransformRecipe = TransformAssetRequest["recipe"];
/** A recipe that takes a still from a video. */
export type FrameRecipe = RecipeWith<"extractFrame">;
/** A recipe for an image. */
export type ImageRecipe = RecipeWith<"crop", "trim">;
/** A recipe that makes a video from a video. */
export type VideoRecipe = RecipeWith<"frameRate">;
/** A recipe for audio, or for a video's sound. */
export type AudioRecipe = RecipeWith<"trim", "rotate">;
/** A transform's run, with `reused` when it returns your earlier run of the same recipe. */
export type TransformRun = Schemas["TransformRun"];
/** A LUT to name as `lut.lutId` in a transform's recipe. */
export type Lut = Schemas["LutList"]["data"][number];
export type Folder = Schemas["Folder"];
export type CreateFolderRequest = Schemas["CreateFolderRequest"];
export type UpdateFolderRequest = Schemas["UpdateFolderRequest"];
export type MoveAssetsRequest = Schemas["MoveAssetsRequest"];
export type FolderDelete = Schemas["FolderDelete"];
export type RestoreFolderRequest = Schemas["RestoreFolderRequest"];
export type FolderRestore = Schemas["FolderRestore"];
export type Label = Schemas["Label"];
export type CreateLabelRequest = Schemas["CreateLabelRequest"];
export type UpdateLabelRequest = Schemas["UpdateLabelRequest"];
export type NamingPreset = Schemas["NamingPreset"];
export type CreateNamingPresetRequest = Schemas["CreateNamingPresetRequest"];
export type Skill = Schemas["Skill"];
export type SkillDetail = Schemas["SkillDetail"];
export type Attachment = Schemas["Attachment"];
export type AttachmentParent = Schemas["AttachmentParent"];
/** An attachment as a read of its project, folder or asset lists it: no body. */
export type AttachmentSummary = Schemas["AttachmentSummary"];
export type AttachmentDetail = Schemas["AttachmentDetail"];
export type AttachmentVersion = Schemas["AttachmentVersion"];
export type CreateAttachmentRequest = Schemas["CreateAttachmentRequest"];
export type ReviseAttachmentRequest = Schemas["ReviseAttachmentRequest"];
export type RestoreAttachmentRequest = Schemas["RestoreAttachmentRequest"];
export type AttachmentCreate = Schemas["AttachmentCreate"];
export type AttachmentRevise = Schemas["AttachmentRevise"];
export type AttachmentDelete = Schemas["AttachmentDelete"];
export type AttachmentRestore = Schemas["AttachmentRestore"];
export type ApiError = Schemas["Error"];
/** More facts about an error; each code says which it carries. */
export type ErrorDetails = NonNullable<ApiError["details"]>;

/** Why a `rate_limited` error's request was refused. */
export type RateLimitReason =
  | "request_limit"
  | "running_cap"
  | "platform_capacity"
  | "url_import_limit";
/** Why a `permission_denied` error's key can't make the request. */
export type PermissionDeniedReason =
  | "scope_required"
  | "role_required"
  | "not_creator"
  | "feature_not_enabled"
  | "early_access"
  | "test_key_sandbox"
  | "browser_request";
/**
 * An error's `details.reason`. The reasons listed are stable for
 * `rate_limited` and `permission_denied`; others can be added, so handle one
 * you don't know as you would the error without a reason.
 */
export type ErrorReason = RateLimitReason | PermissionDeniedReason | (string & {});

export type BalanceQuery = Query<"getBalance">;
export type ModelListQuery = Query<"listModels">;
export type RunListQuery = Omit<Query<"listRuns">, "createdAfter" | "createdBefore"> & {
  /** Only runs created at or after this time; a string is RFC 3339. */
  createdAfter?: Date | string;
  /** Only runs created before this time; a string is RFC 3339. */
  createdBefore?: Date | string;
};
export type ProjectListQuery = Query<"listProjects">;
export type AssetSearchQuery = Omit<Query<"searchAssets">, "favorite"> & {
  /** Only the organization's favorites. */
  favorite?: boolean;
};
export type LineageListQuery = Query<"listAssetSources">;
export type AssetFolderListQuery = Query<"listAssetFolders">;
export type LutListQuery = Query<"listLuts">;
export type FolderListQuery = Omit<Query<"listFolders">, "projectId">;
export type FolderDeleteQuery = Query<"deleteFolder">;
export type LabelListQuery = Omit<Query<"listLabels">, "includeArchived"> & {
  /** Also list archived labels; owners and admins only. */
  includeArchived?: boolean;
};
export type NamingPresetListQuery = Omit<Query<"listNamingPresets">, "projectId">;
export type SkillListQuery = Query<"listSkills">;
export type SkillGetQuery = Query<"getSkill">;
export type AttachmentListQuery = Omit<Query<"listAttachments">, "projectId">;
export type AttachmentGetQuery = Query<"getAttachment">;
export type AttachmentDeleteQuery = Query<"deleteAttachment">;
export type AttachmentVersionListQuery = Query<"listAttachmentVersions">;

/**
 * The recipe form with the step `Has` and without `Lacks`. Forms are told
 * apart by their steps rather than their order, which the API doesn't promise.
 */
type RecipeWith<Has extends string, Lacks extends string = never> = TransformRecipe extends infer R
  ? R extends unknown
    ? Has extends keyof R
      ? [Lacks] extends [never]
        ? R
        : Lacks extends keyof R
          ? never
          : R
      : never
    : never
  : never;

export type { components, operations, paths } from "./openapi.js";
