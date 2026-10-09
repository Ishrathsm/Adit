"use client";

import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Download, Wand2, ChevronLeft, ChevronRight, Image as ImageIcon, Video } from "lucide-react";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  image: string;
  title: string;
  mediaType?: "poster" | "video" | null;
}

interface ImageLightboxProps {
  projects: Project[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  sourceRect: DOMRect | null;
  onCloseComplete?: () => void;
  onNavigate: (index: number) => void;
}

export function ImageLightbox({
  projects,
  currentIndex,
  isOpen,
  onClose,
  sourceRect,
  onCloseComplete,
  onNavigate,
}: ImageLightboxProps) {
  const router = useRouter();
  const [animationPhase, setAnimationPhase] = useState<"initial" | "animating" | "complete">("initial");
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [internalIndex, setInternalIndex] = useState(currentIndex);
  const [isSliding, setIsSliding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalProjects = projects.length;
  const hasNext = internalIndex < totalProjects - 1;
  const hasPrev = internalIndex > 0;

  const currentProject = projects[internalIndex];

  useEffect(() => {
    if (isOpen && currentIndex !== internalIndex && !isSliding) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- drives a 400ms slide transition keyed off the prop change, not derivable state
      setIsSliding(true);

      const timer = setTimeout(() => {
        setInternalIndex(currentIndex);
        setIsSliding(false);
      }, 400);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- internalIndex/isSliding are guards read at effect time, not inputs to re-run on
  }, [currentIndex, isOpen]);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- re-syncs local index/slide state whenever the lightbox (re)opens on a possibly different project
      setInternalIndex(currentIndex);
      setIsSliding(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when the lightbox (re)opens
  }, [isOpen]);

  const navigateNext = useCallback(() => {
    if (internalIndex >= totalProjects - 1 || isSliding) return;
    onNavigate(internalIndex + 1);
  }, [internalIndex, totalProjects, isSliding, onNavigate]);

  const navigatePrev = useCallback(() => {
    if (internalIndex <= 0 || isSliding) return;
    onNavigate(internalIndex - 1);
  }, [internalIndex, isSliding, onNavigate]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    onClose();
    setTimeout(() => {
      setIsClosing(false);
      setShouldRender(false);
      setAnimationPhase("initial");
      onCloseComplete?.();
    }, 400);
  }, [onClose, onCloseComplete]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowRight") navigateNext();
      if (e.key === "ArrowLeft") navigatePrev();
    };

    window.addEventListener("keydown", handleKeyDown);
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleClose, navigateNext, navigatePrev]);

  useLayoutEffect(() => {
    if (isOpen && sourceRect) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off the open animation from the source card's rect, only known once the DOM node exists
      setShouldRender(true);
      setAnimationPhase("initial");
      setIsClosing(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimationPhase("animating");
        });
      });
      const timer = setTimeout(() => {
        setAnimationPhase("complete");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, sourceRect]);

  const handleDotClick = (idx: number) => {
    if (isSliding || idx === internalIndex) return;
    onNavigate(idx);
  };

  if (!shouldRender || !currentProject) return null;

  const getInitialStyles = (): React.CSSProperties => {
    if (!sourceRect) return {};

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const targetWidth = Math.min(768, viewportWidth - 64);
    const targetHeight = Math.min(viewportHeight * 0.85, 600);

    const targetX = (viewportWidth - targetWidth) / 2;
    const targetY = (viewportHeight - targetHeight) / 2;

    const scaleX = sourceRect.width / targetWidth;
    const scaleY = sourceRect.height / targetHeight;
    const scale = Math.max(scaleX, scaleY);

    const translateX = sourceRect.left + sourceRect.width / 2 - (targetX + targetWidth / 2);
    const translateY = sourceRect.top + sourceRect.height / 2 - (targetY + targetHeight / 2);

    return {
      transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
      opacity: 1,
    };
  };

  const getFinalStyles = (): React.CSSProperties => {
    return {
      transform: "translate(0, 0) scale(1)",
      opacity: 1,
    };
  };

  const currentStyles = animationPhase === "initial" && !isClosing ? getInitialStyles() : getFinalStyles();

  return (
    <div
      className={cn("fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8")}
      onClick={handleClose}
      style={{
        opacity: isClosing ? 0 : 1,
        transition: "opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-xl"
        style={{
          opacity: animationPhase === "initial" && !isClosing ? 0 : 1,
          transition: "opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />

      <button
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
        className={cn(
          "absolute top-5 right-5 z-50",
          "w-10 h-10 flex items-center justify-center",
          "rounded-full bg-surface/80 backdrop-blur-md",
          "border border-border-strong",
          "text-muted hover:text-foreground hover:bg-surface",
          "transition-all duration-300 ease-out hover:scale-105 active:scale-95",
        )}
        style={{
          opacity: animationPhase === "complete" && !isClosing ? 1 : 0,
          transform: animationPhase === "complete" && !isClosing ? "translateY(0)" : "translateY(-10px)",
          transition: "opacity 300ms ease-out, transform 300ms ease-out",
        }}
      >
        <X className="w-4 h-4" strokeWidth={2.5} />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          navigatePrev();
        }}
        disabled={!hasPrev || isSliding}
        className={cn(
          "absolute left-4 md:left-8 z-50",
          "w-12 h-12 flex items-center justify-center",
          "rounded-full bg-surface/80 backdrop-blur-md",
          "border border-border-strong",
          "text-muted hover:text-foreground hover:bg-surface",
          "transition-all duration-300 ease-out hover:scale-110 active:scale-95",
          "disabled:opacity-0 disabled:pointer-events-none",
        )}
        style={{
          opacity: animationPhase === "complete" && !isClosing && hasPrev ? 1 : 0,
          transform: animationPhase === "complete" && !isClosing ? "translateX(0)" : "translateX(-20px)",
          transition: "opacity 300ms ease-out 150ms, transform 300ms ease-out 150ms",
        }}
      >
        <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          navigateNext();
        }}
        disabled={!hasNext || isSliding}
        className={cn(
          "absolute right-4 md:right-8 z-50",
          "w-12 h-12 flex items-center justify-center",
          "rounded-full bg-surface/80 backdrop-blur-md",
          "border border-border-strong",
          "text-muted hover:text-foreground hover:bg-surface",
          "transition-all duration-300 ease-out hover:scale-110 active:scale-95",
          "disabled:opacity-0 disabled:pointer-events-none",
        )}
        style={{
          opacity: animationPhase === "complete" && !isClosing && hasNext ? 1 : 0,
          transform: animationPhase === "complete" && !isClosing ? "translateX(0)" : "translateX(20px)",
          transition: "opacity 300ms ease-out 150ms, transform 300ms ease-out 150ms",
        }}
      >
        <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
      </button>

      <div
        ref={containerRef}
        className="relative z-10 w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          ...currentStyles,
          transform: isClosing ? "translate(0, 0) scale(0.95)" : currentStyles.transform,
          transition:
            animationPhase === "initial" && !isClosing
              ? "none"
              : "transform 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 400ms ease-out",
          transformOrigin: "center center",
        }}
      >
        <div
          className={cn("rgb-border relative overflow-hidden", "shadow-2xl shadow-black/40")}
          style={{
            borderRadius: animationPhase === "initial" && !isClosing ? "8px" : "16px",
            transition: "border-radius 500ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div
            className={cn("flex items-center justify-between gap-3", "px-4 py-3", "border-b border-border-subtle")}
            style={{
              opacity: animationPhase === "complete" && !isClosing ? 1 : 0,
              transform: animationPhase === "complete" && !isClosing ? "translateY(0)" : "translateY(-10px)",
              transition: "opacity 300ms ease-out 100ms, transform 300ms ease-out 100ms",
            }}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-foreground/5 text-muted">
                {currentProject.mediaType === "video" ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{currentProject.title}</p>
                <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {currentProject.mediaType === "video" ? "Video" : "Poster"}
                </p>
              </div>
              {totalProjects > 1 && (
                <div className="ml-1 flex shrink-0 items-center gap-1.5">
                  {projects.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleDotClick(idx)}
                      className={cn(
                        "h-1.5 w-1.5 rounded-full transition-all duration-300",
                        idx === internalIndex
                          ? "bg-foreground scale-125"
                          : "bg-muted-foreground/40 hover:bg-muted-foreground/60",
                      )}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <a
                href={`${currentProject.image}?download`}
                download
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-4",
                  "border border-border-strong text-sm font-medium text-foreground",
                  "transition-colors duration-200 hover:bg-foreground/5",
                )}
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Download</span>
              </a>
              <button
                onClick={() => currentProject && router.push(`/projects/${currentProject.id}`)}
                className="shiny-button inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-button-fg transition-transform duration-150 hover:scale-[1.03] active:scale-95"
              >
                <Wand2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Remix this design</span>
              </button>
            </div>
          </div>

          <div className="relative overflow-hidden">
            <div
              className="flex transition-transform duration-400 ease-out"
              style={{
                transform: `translateX(-${internalIndex * 100}%)`,
                transition: isSliding ? "transform 400ms cubic-bezier(0.32, 0.72, 0, 1)" : "none",
              }}
            >
              {projects.map((project) =>
                project.mediaType === "video" ? (
                  <video
                    key={project.id}
                    src={project.image}
                    className="w-full h-auto max-h-[70vh] object-contain bg-background flex-shrink-0"
                    style={{ minWidth: "100%" }}
                    controls
                    playsInline
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- remote, dynamically-generated image
                  <img
                    key={project.id}
                    src={project.image || "/placeholder.svg"}
                    alt={project.title}
                    className="w-full h-auto max-h-[70vh] object-contain bg-background flex-shrink-0"
                    style={{ minWidth: "100%" }}
                  />
                ),
              )}
            </div>

            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-card/20 via-transparent to-card/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
