"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CheckCircle2, XCircle } from "lucide-react";
import { listRecentActivity, type ActivityItem } from "@/lib/api";

const POLL_INTERVAL_MS = 20_000;
const LAST_SEEN_KEY = "adit-activity-last-seen";
const PANEL_HEIGHT = 384; // matches max-h-96 below

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
  const [openPosition, setOpenPosition] = useState<{ top: number; left: number; tailOffset: number } | null>(null);
  const [lastSeen, setLastSeen] = useState<string>("");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const previousIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    // Reading a per-browser preference from storage, not an external subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastSeen(localStorage.getItem(LAST_SEEN_KEY) ?? new Date(0).toISOString());
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
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

  function handleOpen(e: MouseEvent<HTMLButtonElement>) {
    if (openPosition) {
      setOpenPosition(null);
    } else {
      // Portaled to document.body and positioned from the button's own rect — the sidebar's
      // `overflow-y-auto` would otherwise clip an absolutely-positioned dropdown before it
      // ever became visible (the same reason the Poster/Video flow menu is portaled too).
      // Opens beside the bell, speech-bubble style — vertically centered on the button and
      // clamped to the viewport so the tail always still points back at it.
      const rect = e.currentTarget.getBoundingClientRect();
      const buttonCenterY = rect.top + rect.height / 2;
      const top = Math.max(8, Math.min(buttonCenterY - PANEL_HEIGHT / 2, window.innerHeight - PANEL_HEIGHT - 8));
      setOpenPosition({ top, left: rect.right + 12, tailOffset: buttonCenterY - top });
    }
    const now = new Date().toISOString();
    localStorage.setItem(LAST_SEEN_KEY, now);
    setLastSeen(now);
  }

  // A deliberate, separate click (not bundled into just opening the bell) — Chrome can
  // permanently suppress future prompts for a site that asks without a clear, dedicated gesture.
  function handleEnableDesktopNotifications() {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then(setPermission);
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

      {openPosition &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenPosition(null)} />
            {/* A sibling, not a child of the scrollable panel below — nested inside it, the
               panel's own overflow-y-auto would clip this since it pokes out past the edge. */}
            <div
              className="fixed z-50 h-3 w-3 rotate-45 border-b border-l border-border-strong bg-surface"
              style={{ left: openPosition.left - 6, top: openPosition.top + openPosition.tailOffset - 6 }}
            />
            <div
              style={{ top: openPosition.top, left: openPosition.left }}
              className="fixed z-50 max-h-96 w-72 overflow-y-auto rounded-2xl border border-border-strong bg-surface p-2 shadow-lg"
            >
            {permission === "default" && (
              <div className="mb-2 flex flex-col gap-2 rounded-xl border border-border-subtle bg-background/50 p-2.5">
                <div className="flex items-start gap-2">
                  <BellRing size={14} className="mt-0.5 shrink-0 text-muted" />
                  <p className="text-xs text-muted">
                    Get a desktop alert here when a generation finishes — only while this tab is open somewhere.
                  </p>
                </div>
                <button
                  onClick={handleEnableDesktopNotifications}
                  className="self-start rounded-full border border-border-strong px-3 py-1 text-xs font-medium transition-colors hover:bg-white/5"
                >
                  Enable desktop notifications
                </button>
              </div>
            )}
            {permission === "denied" && (
              <p className="mb-2 rounded-xl border border-border-subtle bg-background/50 p-2.5 text-xs text-muted">
                Desktop notifications are blocked for this site — enable them from your browser&apos;s site
                settings if you want an alert outside this tab.
              </p>
            )}

            <p className="px-2 py-1.5 text-xs font-medium tracking-wide text-muted uppercase">Recent activity</p>
            {activity.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted">Nothing yet — generate something!</p>
            ) : (
              activity.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setOpenPosition(null);
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
          </>,
          document.body,
        )}
    </div>
  );
}
