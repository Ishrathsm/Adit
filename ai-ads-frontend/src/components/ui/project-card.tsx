"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  image: string;
  title: string;
  mediaType?: "poster" | "video" | null;
  delay: number;
  isVisible: boolean;
  index: number;
  onClick: () => void;
  isSelected: boolean;
}

export const ProjectCard = forwardRef<HTMLDivElement, ProjectCardProps>(
  ({ image, title, mediaType, delay, isVisible, index, onClick, isSelected }, ref) => {
    const rotations = [-12, 0, 12];
    const translations = [-44, 0, 44];

    return (
      <div
        ref={ref}
        className={cn(
          "absolute w-16 h-[90px] rounded-lg overflow-hidden shadow-xl",
          "bg-card border border-border",
          "cursor-pointer hover:ring-2 hover:ring-accent/50",
          isSelected && "opacity-0",
        )}
        style={{
          transform: isVisible
            ? `translateY(-72px) translateX(${translations[index]}px) rotate(${rotations[index]}deg) scale(1)`
            : "translateY(0px) translateX(0px) rotate(0deg) scale(0.5)",
          opacity: isSelected ? 0 : isVisible ? 1 : 0,
          transition: `all 600ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
          zIndex: 10 - index,
          left: "-32px",
          top: "-45px",
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {mediaType === "video" ? (
          <video src={image} className="h-full w-full object-cover" muted playsInline preload="metadata" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- remote, dynamically-generated thumbnail
          <img src={image} alt={title} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
        <p className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] font-medium text-primary-foreground truncate">
          {title}
        </p>
      </div>
    );
  },
);

ProjectCard.displayName = "ProjectCard";
