"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, Lightbulb, Search, X } from "lucide-react";

type Category = "Poster" | "Video" | "Templates" | "Brand Kit";

type IconComponent = (props: { className?: string }) => React.JSX.Element;

// Solid, gray, glossy glyphs (gradient fill + a subtle top-left highlight), drawn large enough to
// fill most of the 16:9 tile with minimal margin, matching the reference icon style.
const GRADIENT_ID = "tutorial-icon-gradient";

function IconDefs() {
  return (
    <svg width={0} height={0} aria-hidden className="absolute">
      <defs>
        <linearGradient id={GRADIENT_ID} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d4d4d8" />
          <stop offset="45%" stopColor="#9ca3af" />
          <stop offset="100%" stopColor="#52525b" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const PosterIcon: IconComponent = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none">
    <rect x="6" y="4" width="34" height="40" rx="5" fill="#71717a" />
    <rect x="12" y="10" width="34" height="40" rx="5" fill="#9ca3af" />
    <path
      d="M23 16 H42 L52 26 L52 51 Q52 56 47 56 L23 56 Q18 56 18 51 V21 Q18 16 23 16 Z"
      fill={`url(#${GRADIENT_ID})`}
    />
    <path d="M42 16 L52 26 L42 26 Z" fill="#3f3f46" opacity={0.5} />
  </svg>
);

const VideoIcon: IconComponent = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none">
    <path
      d="M44 24 L56 15 Q60 12 60 17 V47 Q60 52 56 49 L44 40 Z"
      fill={`url(#${GRADIENT_ID})`}
      stroke="#27272a"
      strokeOpacity={0.2}
    />
    <rect x="4" y="12" width="42" height="40" rx="9" fill={`url(#${GRADIENT_ID})`} />
  </svg>
);

const RemixIcon: IconComponent = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none">
    <path d="M6 16 C 28 16 28 48 44 48" stroke={`url(#${GRADIENT_ID})`} strokeWidth={9} strokeLinecap="round" />
    <path d="M6 48 C 28 48 28 16 44 16" stroke={`url(#${GRADIENT_ID})`} strokeWidth={9} strokeLinecap="round" />
    <path d="M6 16 C 28 16 28 48 44 48" stroke="#e4e4e7" strokeWidth={2.5} strokeLinecap="round" opacity={0.35} />
    <path d="M6 48 C 28 48 28 16 44 16" stroke="#e4e4e7" strokeWidth={2.5} strokeLinecap="round" opacity={0.35} />
    <polygon points="42,38 58,48 42,58" fill={`url(#${GRADIENT_ID})`} />
    <polygon points="42,6 58,16 42,26" fill={`url(#${GRADIENT_ID})`} />
  </svg>
);

const BriefcaseIcon: IconComponent = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none">
    <rect x="24" y="18" width="16" height="10" rx="4" stroke={`url(#${GRADIENT_ID})`} strokeWidth={4.5} fill="none" />
    <rect x="4" y="24" width="56" height="36" rx="7" fill={`url(#${GRADIENT_ID})`} />
    <rect x="4" y="24" width="56" height="9" fill="#3f3f46" opacity={0.3} />
    <rect x="25" y="28" width="14" height="10" rx="2" fill="#3f3f46" opacity={0.6} />
    <rect x="4" y="57" width="56" height="3" rx="1.5" fill="#e4e4e7" opacity={0.15} />
  </svg>
);

interface Lesson {
  title: string;
  description: string;
  duration: string;
  level: "Beginner" | "Intermediate";
  category: Category;
  icon: IconComponent;
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
    icon: PosterIcon,
    guidePath: "/tutorials/create-your-first-poster",
  },
  {
    title: "Make a video ad",
    description: "Turn your product into an engaging video ad with text, scenes and music.",
    duration: "5 min",
    level: "Beginner",
    category: "Video",
    icon: VideoIcon,
    guidePath: "/tutorials/make-a-video-ad",
  },
  {
    title: "Use templates & Remix",
    description: "Find the right template and remix it for your brand or campaign.",
    duration: "5 min",
    level: "Beginner",
    category: "Templates",
    icon: RemixIcon,
    guidePath: "/tutorials/use-templates-remix",
  },
  {
    title: "Add your brand kit",
    description: "Upload your logo, set brand colors and fonts to keep your ads consistent.",
    duration: "5 min",
    level: "Beginner",
    category: "Brand Kit",
    icon: BriefcaseIcon,
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
  const [playing, setPlaying] = useState<Lesson | null>(null);

  function openLesson(lesson: Lesson) {
    if (lesson.guidePath) {
      router.push(lesson.guidePath);
      return;
    }
    setPlaying(lesson);
  }

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPlaying(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

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
      <IconDefs />
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
              <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-neutral-700 to-neutral-900">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_60%)]" />
                <lesson.icon className="relative h-32 w-32 drop-shadow-[0_4px_6px_rgba(0,0,0,0.45)]" />
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
