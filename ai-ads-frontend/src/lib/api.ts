import { createClient } from "@/lib/supabase/client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export type ProjectType = "poster" | "video";

export interface Project {
  id: string;
  user_id: string;
  product_id: string | null;
  folder_id: string | null;
  name: string;
  type: ProjectType;
  created_at: string;
  // Only populated by listProjects (merged server-side from the latest completed job/
  // storyboard) — the single-project GET doesn't include these.
  preview_url?: string | null;
  preview_type?: "poster" | "video" | null;
}

export interface Folder {
  id: string;
  user_id: string;
  product_id: string | null;
  name: string;
  created_at: string;
}

export type JobStatus = "queued" | "processing" | "completed" | "failed";
export type OutputType = "video" | "poster" | "gif";
export const ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];
// Veo 3.1's hard cap is 8 seconds per single generation.
export const VIDEO_DURATIONS = [4, 6, 8] as const;
export type VideoDuration = (typeof VIDEO_DURATIONS)[number];

export interface Job {
  id: string;
  project_id: string;
  status: JobStatus;
  prompt: string;
  output_type: OutputType;
  aspect_ratio: string;
  duration_seconds: number;
  tagline: string | null;
  template_id: string | null;
  output_url: string | null;
  error: string | null;
  reference_image_url: string | null;
  reference_image_role: "subject" | "style" | null;
  created_at: string;
  updated_at: string;
}

export type TemplateType = "poster" | "video";

export interface Template {
  id: string;
  type: TemplateType;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  template_prompt: string;
  created_at: string;
}

export type AccountType = "individual" | "organisation";
export type Plan = "free" | "pro";
// Mirrors ROLES in ai-ads-backend/src/lib/accounts.ts.
export const ROLES = ["admin", "user"] as const;
export type Role = (typeof ROLES)[number];

// Feature switches — mirrors ai-ads-backend/src/lib/features.ts. Plan gives defaults; admins can
// override any feature per user.
export type FeatureKey = "poster" | "video_quick" | "video_ad" | "long_ads" | "voiceover" | "reference_assets" | "character_sheet";
export type Features = Record<FeatureKey, boolean>;

export interface Account {
  user_id: string;
  account_type: AccountType;
  plan: Plan;
  role: Role;
  disabled: boolean;
  feature_overrides: Partial<Record<FeatureKey, boolean>>;
  created_at: string;
}

export interface Product {
  id: string;
  user_id: string;
  name: string;
  questionnaire_completed: boolean;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  font: string | null;
  tagline: string | null;
  brand_rules: string | null;
  created_at: string;
}

export interface BrandKitInput {
  name?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  font?: string | null;
  tagline?: string | null;
  brandRules?: string | null;
}

// Must match the backend's disabled-account response (ai-ads-backend/src/middleware/auth.ts).
const ACCOUNT_DISABLED_ERROR = "this account has been disabled";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init?.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  // An admin disabled this account while the user was signed in (their token is still valid until
  // it expires) — sign them out and explain on the login page instead of failing call by call.
  if (res.status === 403 && data.error === ACCOUNT_DISABLED_ERROR && typeof window !== "undefined") {
    await supabase.auth.signOut();
    // Full reload on purpose: drops every piece of in-memory app state along with the session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login?disabled=1";
    throw new Error(data.error);
  }
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed with status ${res.status}`);
  }
  return data as T;
}

// Dictation fallback: a recorded clip (base64) turned into text on the server.
export function transcribeAudio(audio: string, mimeType: string) {
  return request<{ text: string }>("/api/transcribe", { method: "POST", body: JSON.stringify({ audio, mimeType }) });
}

export function getAccount() {
  return request<{ account: Account | null; features: Features }>("/api/account");
}

// ---------- admin ----------

export interface AdminUser {
  id: string;
  email: string | null;
  providers: string[];
  createdAt: string;
  lastSignInAt: string | null;
  onboarded: boolean;
  accountType: AccountType | null;
  plan: Plan;
  role: Role;
  disabled: boolean;
  featureOverrides: Partial<Record<FeatureKey, boolean>>;
  features: Features;
  usage: { projects: number; posters: number; videos: number; storyboards: number };
}

export interface AdminAuditEntry {
  id: string;
  admin_user_id: string;
  target_user_id: string;
  action: string;
  details: Record<string, { from: unknown; to: unknown }>;
  created_at: string;
}

export interface AdminFeatureInfo {
  key: FeatureKey;
  label: string;
  description: string;
}

export function adminListUsers() {
  return request<{ users: AdminUser[] }>("/api/admin/users");
}

export function adminGetUser(id: string) {
  return request<{ user: AdminUser; audit: AdminAuditEntry[] }>(`/api/admin/users/${id}`);
}

export function adminListFeatures() {
  return request<{ features: AdminFeatureInfo[]; planDefaults: Record<Plan, Features> }>("/api/admin/features");
}

export interface AdminUserPatch {
  plan?: Plan;
  accountType?: AccountType;
  disabled?: boolean;
  role?: Role;
  // true/false sets an override; null clears it back to the plan default.
  featureOverrides?: Partial<Record<FeatureKey, boolean | null>>;
}

// Emails the user a link to set a new password (passwords can't be viewed — they're stored hashed).
export function adminSendPasswordReset(id: string) {
  return request<{ sent: boolean; email: string }>(`/api/admin/users/${id}/password-reset`, { method: "POST" });
}

export function adminUpdateUser(id: string, patch: AdminUserPatch) {
  return request<{ account: Account; features: Features }>(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function createAccount(accountType: AccountType) {
  return request<{ account: Account }>("/api/account", {
    method: "POST",
    body: JSON.stringify({ accountType }),
  });
}

export function listProducts() {
  return request<{ products: Product[] }>("/api/products");
}

export function createProduct(name: string) {
  return request<{ product: Product }>("/api/products", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function getProduct(id: string) {
  return request<{ product: Product }>(`/api/products/${id}`);
}

export async function uploadLogo(productId: string, file: File): Promise<{ logoUrl: string }> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const formData = new FormData();
  formData.append("logo", file);

  const res = await fetch(`${API_BASE_URL}/api/products/${productId}/logo`, {
    method: "POST",
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  // An admin disabled this account while the user was signed in (their token is still valid until
  // it expires) — sign them out and explain on the login page instead of failing call by call.
  if (res.status === 403 && data.error === ACCOUNT_DISABLED_ERROR && typeof window !== "undefined") {
    await supabase.auth.signOut();
    // Full reload on purpose: drops every piece of in-memory app state along with the session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login?disabled=1";
    throw new Error(data.error);
  }
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed with status ${res.status}`);
  }
  return data;
}

export function completeQuestionnaire(id: string, brand: BrandKitInput) {
  return request<{ product: Product }>(`/api/products/${id}/questionnaire`, {
    method: "PATCH",
    body: JSON.stringify(brand),
  });
}

export function listProjects(options?: { productId?: string; folderId?: string }) {
  const params = new URLSearchParams();
  if (options?.productId) params.set("productId", options.productId);
  if (options?.folderId) params.set("folderId", options.folderId);
  const query = params.toString();
  return request<{ projects: Project[] }>(`/api/projects${query ? `?${query}` : ""}`);
}

export function getProject(id: string) {
  return request<{ project: Project }>(`/api/projects/${id}`);
}

export function createProject(name: string, type: ProjectType, productId?: string) {
  return request<{ project: Project }>("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name, type, productId }),
  });
}

export function updateProject(id: string, options: { name?: string; folderId?: string | null }) {
  return request<{ project: Project }>(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(options),
  });
}

export function deleteProject(id: string) {
  return request<void>(`/api/projects/${id}`, { method: "DELETE" });
}

export function listFolders(productId?: string) {
  const query = productId ? `?productId=${encodeURIComponent(productId)}` : "";
  return request<{ folders: Folder[] }>(`/api/folders${query}`);
}

export function createFolder(name: string, productId?: string) {
  return request<{ folder: Folder }>("/api/folders", {
    method: "POST",
    body: JSON.stringify({ name, productId }),
  });
}

export function renameFolder(id: string, name: string) {
  return request<{ folder: Folder }>(`/api/folders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteFolder(id: string) {
  return request<void>(`/api/folders/${id}`, { method: "DELETE" });
}

// Poster brief — mirrors ai-ads-backend/src/lib/poster-brief.ts.
export interface PosterBrief {
  headline?: string | null;
  subline?: string | null;
  offer?: string | null;
  cta?: string | null;
  contactLine?: string | null;
  // Up to 4 short bullets for a features poster; "Label: detail" sets the label in bold.
  features?: string[];
  tone: AdTone;
  look: AdLook;
  audience?: string | null;
  mustShow?: string | null;
  avoid?: string | null;
  assets?: UploadedAssetInput[];
}

export const MAX_POSTER_ASSETS = 3;

export function createJob(
  projectId: string,
  prompt: string,
  options?: {
    aspectRatio?: AspectRatio;
    durationSeconds?: VideoDuration;
    tagline?: string;
    templateId?: string;
    referenceImageUrl?: string;
    referenceImageRole?: "subject" | "style";
    posterBrief?: PosterBrief;
  },
) {
  return request<{ job: Job }>("/api/jobs", {
    method: "POST",
    body: JSON.stringify({ projectId, prompt, ...options }),
  });
}

export function getJob(id: string) {
  return request<{ job: Job }>(`/api/jobs/${id}`);
}

export function getLatestJobForProject(projectId: string) {
  return request<{ job: Job | null }>(`/api/projects/${projectId}/jobs/latest`);
}

export function listTemplates(type: TemplateType) {
  return request<{ templates: Template[] }>(`/api/templates?type=${type}`);
}

// "casting": a generated character sheet is waiting for approval before shots start.
export type StoryboardStatus = "casting" | "drafting" | "generating_video" | "completed" | "failed";
export type ShotStatus = "pending" | "choices_ready" | "video_ready" | "failed";
export type ReferenceImageRole = "subject" | "style";

// Narrower than the poster flow's aspect ratios — each shot's ratio feeds both image
// generation AND Veo's image-to-video step, and Veo only supports these two.
export const STORYBOARD_ASPECT_RATIOS = [
  { label: "Instagram Story / Reels", value: "9:16" },
  { label: "YouTube / Landscape", value: "16:9" },
] as const;
export type StoryboardAspectRatio = (typeof STORYBOARD_ASPECT_RATIOS)[number]["value"];

// Creative brief for a video ad — mirrors ai-ads-backend/src/lib/creative-brief.ts.
const END_CARD_SECONDS = 2.5;
export const AD_LENGTHS = [15, 20, 30] as const;
export type AdLength = (typeof AD_LENGTHS)[number];

export const AD_TONES = [
  { value: "premium", label: "Premium & minimal" },
  { value: "warm", label: "Warm & emotional" },
  { value: "bold", label: "Bold & energetic" },
  { value: "playful", label: "Playful" },
  { value: "trustworthy", label: "Calm & trustworthy" },
] as const;
export type AdTone = (typeof AD_TONES)[number]["value"];

export const AD_LOOKS = [
  { value: "photoreal", label: "Photoreal" },
  { value: "cinematic", label: "Stylized cinematic" },
  { value: "surreal", label: "Surreal / effects" },
] as const;
export type AdLook = (typeof AD_LOOKS)[number]["value"];

export const AD_PACINGS = [
  { value: "calm", label: "Calm" },
  { value: "balanced", label: "Balanced" },
  { value: "fast", label: "Fast" },
] as const;
export type AdPacing = (typeof AD_PACINGS)[number]["value"];

export const VOICEOVER_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "te", label: "Telugu" },
  { value: "ta", label: "Tamil" },
] as const;
export type VoiceoverLanguage = (typeof VOICEOVER_LANGUAGES)[number]["value"];
export type VoiceGender = "female" | "male";

export const MAX_ON_SCREEN_LINES = 4;

// "ad": multi-shot film; "single": one continuous 4/6/8s shot (the quick Text -> Video).
export type AdFormat = "ad" | "single";
export const SINGLE_SHOT_SECONDS = [4, 6, 8] as const;
export type SingleShotSeconds = (typeof SINGLE_SHOT_SECONDS)[number];
// Multi-shot ads are planned as N shots x S seconds (mirrors ai-ads-backend creative-brief.ts).
export const SHOT_SECONDS = [4, 6, 8] as const;
export type ShotSeconds = (typeof SHOT_SECONDS)[number];
export const SHOT_COUNTS = [2, 3, 4, 5, 6, 7, 8] as const;
export const MAX_FOOTAGE_SECONDS = 32;

export interface CreativeBrief {
  format?: AdFormat;
  singleSeconds?: SingleShotSeconds;
  lengthSeconds: AdLength;
  shotCount?: number | null;
  shotSeconds?: ShotSeconds | null;
  tone: AdTone;
  look: AdLook;
  pacing: AdPacing;
  audience?: string | null;
  keyMessage?: string | null;
  mustShow?: string | null;
  avoid?: string | null;
  brandName?: string | null;
  contactLine?: string | null;
  onScreenText?: string[];
  voiceover?: boolean;
  voiceoverLanguage?: VoiceoverLanguage;
  voiceGender?: VoiceGender;
  voiceoverScript?: string | null;
}

// Seconds of footage (before the end card) — what a voiceover has to fit into.
export function footageSeconds(brief: Pick<CreativeBrief, "format" | "singleSeconds" | "lengthSeconds" | "shotCount" | "shotSeconds">): number {
  if (brief.format === "single") return brief.singleSeconds ?? 8;
  if (brief.shotCount && brief.shotSeconds) return brief.shotCount * brief.shotSeconds;
  return brief.lengthSeconds - END_CARD_SECONDS;
}

// Shot length implies the pacing sent with the brief (the backend derives the same).
export function pacingForShotSeconds(seconds: ShotSeconds): AdPacing {
  return seconds === 4 ? "fast" : seconds === 8 ? "calm" : "balanced";
}

// Same limit the backend enforces on a pasted voiceover (spoken pace x footage time).
export function maxVoiceoverWords(footage: number): number {
  return Math.floor(footage * 2.3 * 1.1);
}

// Same shot plan the backend derives from length + pacing (for the form's preview copy).
const TARGET_CUT_SECONDS: Record<AdPacing, number> = { calm: 4.2, balanced: 3, fast: 2.4 };
export function plannedShotCount(brief: Pick<CreativeBrief, "format" | "lengthSeconds" | "pacing">): number {
  if (brief.format === "single") return 1;
  const footage = brief.lengthSeconds - END_CARD_SECONDS;
  return Math.min(8, Math.max(3, Math.round(footage / TARGET_CUT_SECONDS[brief.pacing])));
}

export interface Storyboard {
  id: string;
  project_id: string;
  concept: string;
  shot_count: number;
  shot_duration_seconds: number;
  aspect_ratio: string;
  reference_image_url: string | null;
  reference_image_role: ReferenceImageRole | null;
  look_sheet: string | null;
  creative_brief: CreativeBrief | null;
  status: StoryboardStatus;
  output_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoryboardShot {
  id: string;
  storyboard_id: string;
  shot_index: number;
  description: string;
  choice_urls: string[] | null;
  selected_choice: number | null;
  video_url: string | null;
  asset_names: string[];
  status: ShotStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
}

// Pro: reference assets (the client's real product / person / location photos) and generated
// character sheets.
export type AssetKind = "character" | "product" | "location";
// Posters also take the client's logo, placed on the finished image (never drawn by the model).
export type PosterAssetKind = AssetKind | "logo";

export interface StoryboardAsset {
  id: string;
  storyboard_id: string;
  kind: AssetKind;
  name: string;
  description: string | null;
  image_url: string | null;
  source: "uploaded" | "generated";
  status: "pending" | "ready" | "failed";
  error: string | null;
}

export interface UploadedAssetInput {
  kind: PosterAssetKind;
  name: string;
  description?: string | null;
  imageUrl: string;
}

export interface CreateStoryboardOptions {
  aspectRatio: StoryboardAspectRatio;
  brief: CreativeBrief;
  assets?: UploadedAssetInput[];
  characterSheet?: boolean;
  referenceImageUrl?: string;
  referenceImageRole?: ReferenceImageRole;
}

export function createStoryboard(projectId: string, concept: string, options: CreateStoryboardOptions) {
  return request<{ storyboard: Storyboard; shots: StoryboardShot[]; assets: StoryboardAsset[] }>("/api/storyboards", {
    method: "POST",
    body: JSON.stringify({ projectId, concept, ...options }),
  });
}

export async function uploadStoryboardReferenceImage(file: File): Promise<{ referenceImageUrl: string }> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch(`${API_BASE_URL}/api/storyboards/reference-image`, {
    method: "POST",
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  // An admin disabled this account while the user was signed in (their token is still valid until
  // it expires) — sign them out and explain on the login page instead of failing call by call.
  if (res.status === 403 && data.error === ACCOUNT_DISABLED_ERROR && typeof window !== "undefined") {
    await supabase.auth.signOut();
    // Full reload on purpose: drops every piece of in-memory app state along with the session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login?disabled=1";
    throw new Error(data.error);
  }
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed with status ${res.status}`);
  }
  return data;
}

export function getStoryboard(id: string) {
  return request<{ storyboard: Storyboard; shots: StoryboardShot[]; assets: StoryboardAsset[] }>(`/api/storyboards/${id}`);
}

// The project's most recent storyboard (null if none) — reopening a video project resumes it.
export function getLatestStoryboard(projectId: string) {
  return request<{ storyboard: Storyboard | null; shots: StoryboardShot[]; assets: StoryboardAsset[] }>(
    `/api/storyboards?projectId=${encodeURIComponent(projectId)}`,
  );
}

// Approve the generated character sheet and start the shots.
export function startStoryboard(id: string) {
  return request<{ storyboard: Storyboard }>(`/api/storyboards/${id}/start`, { method: "POST" });
}

export function regenerateStoryboardAsset(storyboardId: string, assetId: string) {
  return request<{ asset: StoryboardAsset }>(`/api/storyboards/${storyboardId}/assets/${assetId}/regenerate`, { method: "POST" });
}

export function selectShotChoice(storyboardId: string, shotId: string, selectedChoice: number) {
  return request<{ shot: StoryboardShot }>(`/api/storyboards/${storyboardId}/shots/${shotId}`, {
    method: "PATCH",
    body: JSON.stringify({ selectedChoice }),
  });
}

export interface ActivityItem {
  id: string;
  project_id: string;
  project_name: string;
  kind: "job" | "storyboard";
  output_type: "poster" | "video";
  status: "completed" | "failed";
  updated_at: string;
}

export function listRecentActivity() {
  return request<{ activity: ActivityItem[] }>("/api/notifications");
}
