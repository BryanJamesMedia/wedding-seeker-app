"use client";

/* eslint-disable @next/next/no-img-element */
import { Play, X } from "lucide-react";
import { useRef } from "react";

const VIDEO_URL = "https://pvrbo3tqzss464bl.public.blob.vercel-storage.com/Video/Hero%20Explination.mp4";

export function HeroVideo() {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          dialog.current?.showModal();
          void video.current?.play().catch(() => {});
        }}
        aria-label="Play video"
        className="group relative aspect-square w-64 overflow-hidden rounded-full shadow-2xl ring-4 ring-white/20 transition-all hover:ring-white/40 md:w-80 lg:w-96"
      >
        <img src="/landing/hero-video-thumbnail.jpg" alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <span className="absolute inset-0 bg-navy/30 transition-colors group-hover:bg-navy/20" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="absolute h-20 w-20 animate-ping rounded-full bg-white/30 motion-reduce:animate-none md:h-24 md:w-24" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-xl transition-transform group-hover:scale-110 md:h-20 md:w-20">
            <Play className="ml-1 h-7 w-7 fill-accent text-accent md:h-9 md:w-9" aria-hidden />
          </span>
        </span>
      </button>
      <dialog
        ref={dialog}
        aria-label="Video player"
        onClose={() => video.current?.pause()}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="m-auto w-[min(64rem,92vw)] overflow-visible bg-transparent p-0 backdrop:bg-navy/90 backdrop:backdrop-blur-sm"
      >
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close video" className="absolute -top-14 right-0 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
          <X className="h-6 w-6" aria-hidden />
        </button>
        <video ref={video} src={VIDEO_URL} poster="/landing/hero-video-thumbnail.jpg" controls playsInline preload="none" className="aspect-video w-full rounded-lg bg-black">
          Your browser does not support the video tag.
        </video>
      </dialog>
    </>
  );
}
