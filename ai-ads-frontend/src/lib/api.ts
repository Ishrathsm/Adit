import { createClient } from "@/lib/supabase/client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export type ProjectType = "poster" | "video";

export interface Project {
  id: string;
  user_id: string;
  product_id: string | null;
  name: string;
  type: ProjectType;
  created_at: string;
}

export type JobStatus = "queued" | "processing" | "completed" | "failed";
export type OutputType = "video" | "poster" | "gif";
export const ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export interface Job {
  id: string;
  project_id: string;
  status: JobStatus;
  prompt: string;
  output_type: OutputType;
  aspect_ratio: string;
  tagline: string | null;
  template_id: string | null;
  output_url: string | null;
  error: string | null;
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

export interface Account {
  user_id: string;
  account_type: AccountType;
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
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  font: string;
  tagline?: string | null;
  brandRules: string;
}

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
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed with status ${res.status}`);
  }
  return data as T;
}

export function getAccount() {
  return request<{ account: Account | null }>("/api/account");
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

export function listProjects() {
  return request<{ projects: Project[] }>("/api/projects");
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

export function createJob(
  projectId: string,
  prompt: string,
  options?: { aspectRatio?: AspectRatio; tagline?: string; templateId?: string },
) {
  return request<{ job: Job }>("/api/jobs", {
    method: "POST",
    body: JSON.stringify({ projectId, prompt, ...options }),
  });
}

export function getJob(id: string) {
  return request<{ job: Job }>(`/api/jobs/${id}`);
}

export function listTemplates(type: TemplateType) {
  return request<{ templates: Template[] }>(`/api/templates?type=${type}`);
}

export type StoryboardStatus = "drafting" | "generating_video" | "completed" | "failed";
export type ShotStatus = "pending" | "choices_ready" | "video_ready" | "failed";
export type ReferenceImageRole = "subject" | "style";

export const STORYBOARD_ASPECT_RATIOS = [
  { label: "Instagram Story / Reels", value: "9:16" },
  { label: "Instagram Post (Square)", value: "1:1" },
  { label: "Instagram Portrait", value: "4:5" },
  { label: "YouTube / Landscape", value: "16:9" },
  { label: "Classic Portrait", value: "3:4" },
] as const;
export type StoryboardAspectRatio = (typeof STORYBOARD_ASPECT_RATIOS)[number]["value"];

export const STORYBOARD_SHOT_DURATIONS = [4, 6, 8] as const;
export type StoryboardShotDuration = (typeof STORYBOARD_SHOT_DURATIONS)[number];

export const STORYBOARD_SHOT_COUNTS = [2, 3, 4] as const;
export type StoryboardShotCount = (typeof STORYBOARD_SHOT_COUNTS)[number];

export interface Storyboard {
  id: string;
  project_id: string;
  concept: string;
  shot_count: number;
  shot_duration_seconds: number;
  aspect_ratio: string;
  reference_image_url: string | null;
  reference_image_role: ReferenceImageRole | null;
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
  status: ShotStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStoryboardOptions {
  aspectRatio: StoryboardAspectRatio;
  shotCount: StoryboardShotCount;
  shotDurationSeconds: StoryboardShotDuration;
  referenceImageUrl?: string;
  referenceImageRole?: ReferenceImageRole;
}

export function createStoryboard(projectId: string, concept: string, options: CreateStoryboardOptions) {
  return request<{ storyboard: Storyboard; shots: StoryboardShot[] }>("/api/storyboards", {
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
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed with status ${res.status}`);
  }
  return data;
}

export function getStoryboard(id: string) {
  return request<{ storyboard: Storyboard; shots: StoryboardShot[] }>(`/api/storyboards/${id}`);
}

export function selectShotChoice(storyboardId: string, shotId: string, selectedChoice: number) {
  return request<{ shot: StoryboardShot }>(`/api/storyboards/${storyboardId}/shots/${shotId}`, {
    method: "PATCH",
    body: JSON.stringify({ selectedChoice }),
  });
}
