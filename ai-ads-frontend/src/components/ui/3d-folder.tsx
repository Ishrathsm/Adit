"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ProjectCard } from "@/components/ui/project-card";
import { ImageLightbox } from "@/components/ui/image-lightbox";

interface Project {
  id: string;
  image: string;
  title: string;
  mediaType?: "poster" | "video" | null;
}

interface AnimatedFolderProps {
  title: string;
  projects: Project[];
  /** Real item count for the folder — `projects` is just the (up to 3) preview stack. */
  totalCount: number;
  /** Called when the folder itself (not a preview card) is clicked. */
  onOpen?: () => void;
  renaming?: boolean;
  renameValue?: string;
  onRenameChange?: (value: string) => void;
  onRenameSubmit?: () => void;
  onRenameCancel?: () => void;
  className?: string;
}

export function AnimatedFolder({
  title,
  projects,
  totalCount,
  onOpen,
  renaming = false,
  renameValue = "",
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  className,
}: AnimatedFolderProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [sourceRect, setSourceRect] = useState<DOMRect | null>(null);
  const [hiddenCardId, setHiddenCardId] = useState<string | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const previewCards = projects.slice(0, 3);

  const handleProjectClick = (project: Project, index: number) => {
    const cardEl = cardRefs.current[index];
    if (cardEl) {
      setSourceRect(cardEl.getBoundingClientRect());
    }
    setSelectedIndex(index);
    setHiddenCardId(project.id);
  };

  const handleCloseLightbox = () => {
    setSelectedIndex(null);
    setSourceRect(null);
  };

  const handleCloseComplete = () => {
    setHiddenCardId(null);
  };

  const handleNavigate = (newIndex: number) => {
    setSelectedIndex(newIndex);
    setHiddenCardId(previewCards[newIndex]?.id || null);
  };

  return (
    <>
      <div
        className={cn(
          "relative flex flex-col items-center justify-center",
          "p-6 rounded-2xl cursor-pointer",
          "bg-card border border-border",
          "transition-all duration-500 ease-out",
          "hover:shadow-2xl hover:shadow-accent/10",
          "hover:border-accent/30",
          "group",
          className,
        )}
        style={{
          minWidth: "224px",
          minHeight: "256px",
          perspective: "1000px",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => !renaming && onOpen?.()}
      >
        <div
          className="absolute inset-0 rounded-2xl transition-opacity duration-500"
          style={{
            background: "radial-gradient(circle at 50% 70%, var(--accent) 0%, transparent 70%)",
            opacity: isHovered ? 0.08 : 0,
          }}
        />

        <div className="relative flex items-center justify-center mb-3" style={{ height: "128px", width: "160px" }}>
          <div
            className="absolute w-[102px] h-[77px] bg-folder-back rounded-lg shadow-md"
            style={{
              transformOrigin: "bottom center",
              transform: isHovered ? "rotateX(-15deg)" : "rotateX(0deg)",
              transition: "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              zIndex: 10,
            }}
          />

          <div
            className="absolute w-[38px] h-[13px] bg-folder-tab rounded-t-md"
            style={{
              top: "calc(50% - 38.5px - 9.6px)",
              left: "calc(50% - 51.2px + 12.8px)",
              transformOrigin: "bottom center",
              transform: isHovered ? "rotateX(-25deg) translateY(-1.6px)" : "rotateX(0deg)",
              transition: "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              zIndex: 10,
            }}
          />

          <div
            className="absolute"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 20,
            }}
          >
            {previewCards.map((project, index) => (
              <ProjectCard
                key={project.id}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                image={project.image}
                title={project.title}
                mediaType={project.mediaType}
                delay={index * 80}
                isVisible={isHovered}
                index={index}
                onClick={() => handleProjectClick(project, index)}
                isSelected={hiddenCardId === project.id}
              />
            ))}
          </div>

          <div
            className="absolute w-[102px] h-[77px] bg-folder-front rounded-lg shadow-lg"
            style={{
              top: "calc(50% - 38.4px + 3.2px)",
              transformOrigin: "bottom center",
              transform: isHovered ? "rotateX(25deg) translateY(6.4px)" : "rotateX(0deg)",
              transition: "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              zIndex: 30,
            }}
          />

          <div
            className="absolute w-[102px] h-[77px] rounded-lg overflow-hidden pointer-events-none"
            style={{
              top: "calc(50% - 38.4px + 3.2px)",
              background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)",
              transformOrigin: "bottom center",
              transform: isHovered ? "rotateX(25deg) translateY(6.4px)" : "rotateX(0deg)",
              transition: "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              zIndex: 31,
            }}
          />
        </div>

        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onRenameChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameSubmit?.();
              if (e.key === "Escape") onRenameCancel?.();
            }}
            onBlur={() => onRenameSubmit?.()}
            className="relative z-10 mt-3 w-full max-w-[160px] rounded-lg border border-border bg-background px-2 py-1 text-center text-sm outline-none"
          />
        ) : (
          <h3
            className="text-lg font-semibold text-foreground mt-3 transition-all duration-300"
            style={{
              transform: isHovered ? "translateY(4px)" : "translateY(0)",
            }}
          >
            {title}
          </h3>
        )}

        <p
          className="text-sm text-muted-foreground transition-all duration-300"
          style={{
            opacity: isHovered ? 0.7 : 1,
          }}
        >
          {totalCount} {totalCount === 1 ? "item" : "items"}
        </p>

        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-xs text-muted-foreground transition-all duration-300"
          style={{
            opacity: isHovered ? 0 : 0.6,
            transform: isHovered ? "translateY(10px)" : "translateY(0)",
          }}
        >
          <span>Hover to explore</span>
        </div>
      </div>

      <ImageLightbox
        projects={previewCards}
        currentIndex={selectedIndex ?? 0}
        isOpen={selectedIndex !== null}
        onClose={handleCloseLightbox}
        sourceRect={sourceRect}
        onCloseComplete={handleCloseComplete}
        onNavigate={handleNavigate}
      />
    </>
  );
}
