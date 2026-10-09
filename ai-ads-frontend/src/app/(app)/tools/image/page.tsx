"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Download, ImagePlus, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ASPECT_RATIOS, IMAGE_TOOLS, runImageTool, type AspectRatio, type ImageTool } from "@/lib/api";

function chipClass(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
    active
      ? "border-transparent bg-button-bg text-button-fg"
      : "border-border-strong text-foreground hover:bg-foreground/5"
  }`;
}

interface Picked {
  file: File;
  previewUrl: string;
}

// One-step image edits (DaVinci-style tools): pick a picture, a tool and, where needed, a line
// saying what you want. Each result is saved as a new project and can be fed into the next tool.
// useSearchParams (the active brand, ?product=) needs a Suspense boundary for the static build.
export default function ImageToolsPage() {
  return (
    <Suspense fallback={null}>
      <ImageTools />
    </Suspense>
  );
}

function ImageTools() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("product");
  const [tool, setTool] = useState<ImageTool>("upscale");
  const [image, setImage] = useState<Picked | null>(null);
  const [instruction, setInstruction] = useState("");
  const [expandRatio, setExpandRatio] = useState<AspectRatio>("16:9");
  const [size, setSize] = useState<"2K" | "4K">("2K");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ projectId: string; outputUrl: string } | null>(null);

  const current = IMAGE_TOOLS.find((t) => t.id === tool)!;
  const needsWords = "placeholder" in current;

  // Free the previous preview's memory whenever the picture changes.
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.previewUrl);
    },
    [image],
  );

  function pick(file: File | undefined) {
    if (!file) return;
    setImage({ file, previewUrl: URL.createObjectURL(file) });
    setResult(null);
    setError(null);
  }

  async function apply() {
    if (!image || running || (needsWords && !instruction.trim())) return;
    setRunning(true);
    setError(null);
    try {
      setResult(
        await runImageTool(image.file, {
          tool,
          instruction: needsWords ? instruction.trim() : undefined,
          aspectRatio: tool === "expand" ? expandRatio : undefined,
          size: tool === "upscale" ? size : undefined,
          productId,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  // Chain edits: the result becomes the next tool's input.
  async function useResult() {
    if (!result) return;
    const blob = await fetch(result.outputUrl).then((r) => r.blob());
    pick(new File([blob], "edited.png", { type: blob.type || "image/png" }));
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Image tools</h1>
        <p className="text-sm text-muted">
          Upscale, swap the background, expand, restyle, relight or remove things from any picture.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tool">
        {IMAGE_TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tool === t.id}
            disabled={running}
            onClick={() => {
              setTool(t.id);
              setInstruction("");
            }}
            className={chipClass(tool === t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rgb-border flex flex-col gap-4 p-5">
          <label className="group relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-border-strong bg-foreground/5 text-sm text-muted transition-colors hover:bg-foreground/10 hover:text-foreground">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview of a picked file
              <img src={image.previewUrl} alt="Your picture" className="h-full w-full object-contain" />
            ) : (
              <>
                <ImagePlus size={22} />
                <span>Upload a picture</span>
                <span className="text-xs">PNG or JPG, up to 15 MB</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={running}
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </label>

          <p className="text-sm text-muted">{current.hint}.</p>
          {needsWords && (
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              disabled={running}
              maxLength={300}
              placeholder={current.placeholder}
              className="rounded-full border border-border-subtle bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-border-strong disabled:opacity-50"
            />
          )}
          {tool === "expand" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">New shape</span>
              {ASPECT_RATIOS.map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={running}
                  onClick={() => setExpandRatio(r)}
                  className={chipClass(expandRatio === r)}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          {tool === "upscale" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">Size</span>
              {(["2K", "4K"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={running}
                  onClick={() => setSize(s)}
                  className={chipClass(size === s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <Button
            onClick={apply}
            disabled={!image || running || (needsWords && !instruction.trim())}
            className="w-full"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : null}
            {running ? "Working… about 15 seconds" : `${current.label}`}
          </Button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="rgb-border flex flex-col gap-4 p-5">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-foreground/5 text-sm text-muted">
            {result ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote, generated image
              <img src={result.outputUrl} alt="Result" className="h-full w-full object-contain" />
            ) : running ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <span>Your result appears here</span>
            )}
          </div>
          {result && (
            <div className="flex flex-wrap gap-2">
              <a
                href={`${result.outputUrl.split("?")[0]}?download`}
                download
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-strong px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
              >
                <Download size={14} /> Download
              </a>
              <button
                type="button"
                onClick={useResult}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-strong px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
              >
                <RotateCcw size={14} /> Edit this result
              </button>
              <Link
                href={`/projects/${result.projectId}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-muted transition-colors hover:text-foreground"
              >
                Open as project <ArrowRight size={14} />
              </Link>
            </div>
          )}
          <p className="text-xs text-muted">Every result is saved to your Projects.</p>
        </div>
      </div>
    </main>
  );
}
