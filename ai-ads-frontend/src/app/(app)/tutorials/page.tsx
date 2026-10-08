"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, Lightbulb, Search, X } from "lucide-react";
import { listTemplates, type Template } from "@/lib/api";

type Category = "Poster" | "Video" | "Templates" | "Brand Kit";

interface Lesson {
  title: string;
  description: string;
  duration: string;
  level: "Beginner" | "Intermediate";
  category: Category;
  // When set, this lesson opens its own dedicated step-by-step page (real app screenshots) instead
  // of the generic video modal every other lesson uses.
  guidePath?: string;
}

// A curated "getting started" set — six essentials covering the core product, not an exhaustive
// catalog. Each one maps to a real, existing part of Adit (the poster flow, the video flow,
// templates/remix, the brand kit, aspect ratios, export) rather than generic stock topics.
const LESSONS: Lesson[] = [
  {
    title: "Create your first poster",
    description: "Learn how to create a stunning poster using templates, your product and AI tools.",
    duration: "5 min",
    level: "Beginner",
    category: "Poster",
    guidePath: "/tutorials/create-your-first-poster",
  },
  {
    title: "Make a video ad",
    description: "Turn your product into an engaging video ad with text, scenes and music.",
    duration: "5 min",
    level: "Beginner",
    category: "Video",
    guidePath: "/tutorials/make-a-video-ad",
  },
  {
    title: "Use templates & Remix",
    description: "Find the right template and remix it for your brand or campaign.",
    duration: "5 min",
    level: "Beginner",
    category: "Templates",
    guidePath: "/tutorials/use-templates-remix",
  },
  {
    title: "Add your brand kit",
    description: "Upload your logo, set brand colors and fonts to keep your ads consistent.",
    duration: "5 min",
    level: "Beginner",
    category: "Brand Kit",
    guidePath: "/tutorials/add-your-brand-kit",
  },
];

const CATEGORIES: Category[] = ["Poster", "Video", "Templates", "Brand Kit"];
const ALL = "All" as const;
type Filter = typeof ALL | Category;

function pillClass(active: boolean) {
  return `rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
    active ? "border-transparent bg-button-bg text-button-fg" : "border-border-strong text-foreground hover:bg-white/5"
  }`;
}

// A static, informational page — there's no tutorials API, so the catalog above is the entire
// data source. Clicking a card opens an in-place player (a modal, same chrome as the Templates
// preview dialog), using the project's one existing sample video as the actual playable content
// until real per-lesson recordings exist.
export default function TutorialsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>(ALL);
  const [search, setSearch] = useState("");
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [playing, setPlaying] = useState<Lesson | null>(null);

  function openLesson(lesson: Lesson) {
    if (lesson.guidePath) {
      router.push(lesson.guidePath);
      return;
    }
    setPlaying(lesson);
  }

  useEffect(() => {
    listTemplates("poster")
      .then(({ templates }) => setTemplates(templates.filter((t) => t.thumbnail_url)))
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPlaying(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

  // There's no lesson video library to pull real thumbnails from, so each card reuses one of the
  // existing template images already in the project — assigned once per title, so a lesson's
  // picture never changes as the filter is applied.
  const imageByTitle = useMemo(() => {
    const map: Record<string, string> = {};
    if (!templates?.length) return map;
    LESSONS.forEach((lesson, i) => {
      map[lesson.title] = templates[i % templates.length].thumbnail_url!;
    });
    return map;
  }, [templates]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return LESSONS.filter((lesson) => {
      if (filter !== ALL && lesson.category !== filter) return false;
      if (query && !lesson.title.toLowerCase().includes(query) && !lesson.description.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [filter, search]);

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-10 sm:px-10">
      <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Learn Adit</h1>
          <p className="mt-1 text-base font-medium">Create better ads, faster.</p>
        </div>

        {/* Purely informational — no click/navigation target. */}
        <div className="rgb-border flex w-full max-w-sm items-start gap-3 p-4 text-left sm:w-auto">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-strong text-muted">
            <Lightbulb size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">New to Adit?</p>
            <p className="text-xs text-muted">Start with the basics and learn how to create your first ad in minutes.</p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="What do you want to learn?"
            className="w-full rounded-full border border-border-subtle bg-background py-2.5 pr-4 pl-9 text-sm outline-none placeholder:text-muted focus:border-border-strong"
          />
        </div>
        <button type="button" onClick={() => setFilter(ALL)} className={pillClass(filter === ALL)}>
          All
        </button>
        {CATEGORIES.map((value) => (
          <button key={value} type="button" onClick={() => setFilter(value)} className={pillClass(filter === value)}>
            {value}
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <p className="rgb-border mt-8 p-8 text-center text-sm text-muted">No lessons match these filters.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 pb-10 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((lesson) => (
            <button
              key={lesson.title}
              type="button"
              onClick={() => openLesson(lesson)}
              className="rgb-border flex h-full flex-col gap-1.5 p-2.5 text-left transition-colors hover:bg-white/5"
            >
              <span className="w-fit rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                Lesson
              </span>
              <div className="relative aspect-video overflow-hidden rounded-xl bg-surface">
                {imageByTitle[lesson.title] && (
                  <>
                    {/* A heavily blurred, dim backdrop so a portrait image doesn't leave stark
                        empty bars next to the landscape ones — just an ambient color wash, not a
                        recognizable copy, so it reads as intentional rather than messy. */}
                    {/* eslint-disable-next-line @next/next/no-img-element -- decorative backdrop fill, not meaningful content */}
                    <img src={imageByTitle[lesson.title]} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-150 object-cover opacity-25 blur-3xl" />
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote curated template image, reused as a lesson thumbnail */}
                    <img src={imageByTitle[lesson.title]} alt="" className="absolute inset-0 h-full w-full object-contain" />
                  </>
                )}
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{lesson.title}</h3>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{lesson.description}</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                    <Clock size={12} /> {lesson.duration} · {lesson.level}
                  </p>
                </div>
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-strong text-muted">
                  <ArrowRight size={14} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {playing &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setPlaying(null)}
            role="dialog"
            aria-modal="true"
            aria-label={playing.title}
          >
            <div
              className="rgb-border flex w-full max-w-2xl flex-col gap-4 bg-background p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight">{playing.title}</h2>
                <button
                  type="button"
                  onClick={() => setPlaying(null)}
                  aria-label="Close"
                  className="rounded-full p-1 text-muted hover:text-foreground"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-hidden rounded-2xl bg-black">
                {/* The project's one existing sample clip — plays as real video, standing in for
                    a per-lesson recording until one exists for each item. */}
                <video src="/samples/video.mp4" controls autoPlay className="aspect-video w-full" />
              </div>
              <p className="text-sm text-muted">{playing.description}</p>
            </div>
          </div>,
          document.body,
        )}
    </main>
  );
}
