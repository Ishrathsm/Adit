import { supabase } from "./supabase";

export type ActivityStatus = "completed" | "failed";
export type ActivityKind = "job" | "storyboard";

export interface ActivityItem {
  id: string;
  project_id: string;
  project_name: string;
  kind: ActivityKind;
  output_type: "poster" | "video";
  status: ActivityStatus;
  updated_at: string;
}

// Derived from the existing jobs/storyboards tables rather than a dedicated notifications
// table — "recently finished generations" is just a query, not state that needs its own
// storage. Mirrors the merge-two-tables approach in getProjectPreviews (lib/projects.ts).
export async function listRecentActivity(userId: string, limit = 20): Promise<ActivityItem[]> {
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", userId);
  if (projectsError) throw projectsError;
  if (!projects || projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);
  const nameById = new Map(projects.map((p) => [p.id, p.name]));

  const [{ data: jobs, error: jobsError }, { data: storyboards, error: storyboardsError }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, project_id, output_type, status, updated_at")
      .in("project_id", projectIds)
      .in("status", ["completed", "failed"])
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("storyboards")
      .select("id, project_id, status, updated_at")
      .in("project_id", projectIds)
      .in("status", ["completed", "failed"])
      .order("updated_at", { ascending: false })
      .limit(limit),
  ]);
  if (jobsError) throw jobsError;
  if (storyboardsError) throw storyboardsError;

  const items: ActivityItem[] = [
    ...(jobs ?? []).map((job) => ({
      id: job.id,
      project_id: job.project_id,
      project_name: nameById.get(job.project_id) ?? "Untitled",
      kind: "job" as const,
      output_type: job.output_type === "poster" ? ("poster" as const) : ("video" as const),
      status: job.status as ActivityStatus,
      updated_at: job.updated_at,
    })),
    ...(storyboards ?? []).map((storyboard) => ({
      id: storyboard.id,
      project_id: storyboard.project_id,
      project_name: nameById.get(storyboard.project_id) ?? "Untitled",
      kind: "storyboard" as const,
      output_type: "video" as const,
      status: storyboard.status as ActivityStatus,
      updated_at: storyboard.updated_at,
    })),
  ];

  items.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return items.slice(0, limit);
}
