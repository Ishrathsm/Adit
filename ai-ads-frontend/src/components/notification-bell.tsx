"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle2, XCircle } from "lucide-react";
import { listRecentActivity, type ActivityItem } from "@/lib/api";

const POLL_INTERVAL_MS = 20_000;
const LAST_SEEN_KEY = "adit-activity-last-seen";

function relativeTime(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function label(item: ActivityItem) {
  const noun = item.output_type === "poster" ? "Poster" : "Video";
  return item.status === "completed" ? `${noun} ready` : `${noun} failed`;
}

export function NotificationBell() {
  const router = useRouter();
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<string>("");
  const previousIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    // Reading a per-browser preference from storage, not an external subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastSeen(localStorage.getItem(LAST_SEEN_KEY) ?? new Date(0).toISOString());
  }, []);

  useEffect(() => {
    function poll() {
      listRecentActivity()
        .then(({ activity }) => {
          // Best-effort desktop notification for items that are newly finished since the
          // previous poll (not just "unseen") — permission is only ever requested from a
          // real click (see handleOpen), never on load.
          if (previousIdsRef.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
            for (const item of activity) {
              if (!previousIdsRef.current.has(item.id)) {
                new Notification(label(item), { body: item.project_name, tag: item.id });
              }
            }
          }
          previousIdsRef.current = new Set(activity.map((item) => item.id));
          setActivity(activity);
        })
        .catch(() => {
          /* transient network errors during background polling — next tick retries */
        });
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = activity.filter((item) => item.updated_at > lastSeen).length;

  function handleOpen() {
    setOpen((v) => !v);
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {
        /* ignored — the in-app bell/badge is the reliable path regardless */
      });
    }
    const now = new Date().toISOString();
    localStorage.setItem(LAST_SEEN_KEY, now);
    setLastSeen(now);
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        title="Notifications"
        className="relative flex h-10 w-full items-center justify-center gap-2.5 rounded-xl text-muted transition-colors hover:bg-white/5 hover:text-foreground sm:justify-start sm:px-3"
      >
        <Bell size={16} className="shrink-0" />
        <span className="hidden text-sm font-medium sm:inline">Notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1.5 left-6 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white sm:static sm:ml-auto">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-0 left-full z-50 ml-2 max-h-96 w-72 overflow-y-auto rounded-2xl border border-border-strong bg-surface p-2 shadow-lg sm:bottom-auto sm:top-0 sm:left-full">
            <p className="px-2 py-1.5 text-xs font-medium tracking-wide text-muted uppercase">Recent activity</p>
            {activity.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted">Nothing yet — generate something!</p>
            ) : (
              activity.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setOpen(false);
                    router.push(`/projects/${item.project_id}`);
                  }}
                  className="flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/5"
                >
                  {item.status === "completed" ? (
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{label(item)}</span>
                    <span className="block truncate text-xs text-muted">{item.project_name}</span>
                  </span>
                  <span className="shrink-0 text-[10px] text-muted">{relativeTime(item.updated_at)}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
