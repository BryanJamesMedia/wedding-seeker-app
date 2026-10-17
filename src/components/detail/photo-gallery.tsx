"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { GalleryPhoto } from "@/lib/listing";

const GRID_COUNT = 5;

export function PhotoGallery({ name, photos, lockedCount }: { name: string; photos: GalleryPhoto[]; lockedCount: number }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const total = photos.length;

  const step = useCallback((delta: number) => setIndex((i) => (i == null ? i : (i + delta + total) % total)), [total]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (index != null && !dialog.open) dialog.showModal();
    if (index == null && dialog.open) dialog.close();
  }, [index]);

  if (!total && !lockedCount) return null;

  const alt = (i: number) => photos[i]?.alt || `${name} photo ${i + 1}`;
  const shown = photos.slice(0, GRID_COUNT);
  const hiddenCount = total - shown.length;
  const current = index == null ? null : photos[index];

  return (
    <>
      <section aria-label="Photos" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {shown.map((photo, i) => {
          const last = i === shown.length - 1 && hiddenCount > 0;
          return (
            <button
              key={photo.src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={last ? `View all ${total} photos` : `Open photo ${i + 1} of ${total}`}
              className={`group relative overflow-hidden rounded-xl bg-accent-soft ${i === 0 ? "col-span-2 row-span-2" : "aspect-[4/3]"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.src}
                alt={alt(i)}
                loading={i < 2 ? "eager" : "lazy"}
                className={`w-full object-cover transition duration-300 group-hover:scale-[1.03] ${i === 0 ? "aspect-[4/3] h-full" : "h-full"}`}
              />
              {last ? (
                <span className="absolute inset-0 flex items-center justify-center bg-navy/60 text-lg font-semibold text-white">
                  +{hiddenCount + 1} photos
                </span>
              ) : null}
            </button>
          );
        })}
        {lockedCount > 0 ? (
          <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-accent-soft p-3 text-center text-sm text-accent">
            +{lockedCount} more photos with Plus
          </div>
        ) : null}
      </section>

      <dialog
        ref={ref}
        onClose={() => setIndex(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setIndex(null);
        }}
        aria-label={`${name} photos`}
        className="m-auto h-dvh max-h-none w-screen max-w-none bg-black/95 p-0 backdrop:bg-black/80"
      >
        {current ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4" onClick={(e) => e.target === e.currentTarget && setIndex(null)}>
            <div className="flex w-full max-w-6xl items-center justify-between text-sm text-white/80">
              <span>
                {index! + 1} / {total}
              </span>
              <button type="button" onClick={() => setIndex(null)} aria-label="Close photos" className="rounded-full p-2 text-white hover:bg-white/10">
                <X className="size-6" aria-hidden />
              </button>
            </div>
            <div className="relative flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.src} alt={alt(index!)} className="max-h-full max-w-full rounded-lg object-contain" />
              {total > 1 ? (
                <>
                  <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className="absolute left-0 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 sm:-left-2">
                    <ChevronLeft className="size-7" aria-hidden />
                  </button>
                  <button type="button" onClick={() => step(1)} aria-label="Next photo" className="absolute right-0 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 sm:-right-2">
                    <ChevronRight className="size-7" aria-hidden />
                  </button>
                </>
              ) : null}
            </div>
            {current.alt ? <p className="max-w-3xl text-center text-sm text-white/80">{current.alt}</p> : null}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
