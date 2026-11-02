"use client";

import { useState } from "react";

interface Props {
  src: string | null;
  title: string;
  year?: number | null;
  className?: string;
  eager?: boolean;
}

const PALETTES = [
  ["#0d6b6e", "#5fb3a9"],
  ["#e0573a", "#f4a259"],
  ["#2f4858", "#86bbd8"],
  ["#6b4e71", "#c49bbb"],
  ["#3d5a40", "#a3b18a"],
  ["#8c3b2f", "#d9a48f"],
  ["#1c2230", "#5d6474"],
  ["#9a6a1f", "#e6c46b"],
]

function paletteFor(title: string) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) | 0;
  return PALETTES[Math.abs(h) % PALETTES.length];
}

/**
 * Library cover art with a generated fallback. Covers come from the library's
 * image service, which serves a 1x1 blank gif when it has no art, so we treat
 * tiny images as missing.
 */
export function Poster({
  src,
  title,
  year,
  className = "",
  eager = false,
}: Props) {
  const [failed, setFailed] = useState(!src);
  const [loaded, setLoaded] = useState(false);
  const [from, to] = paletteFor(title);

  const check = (img: HTMLImageElement) => {
    if (img.naturalWidth < 20) setFailed(true);
    else setLoaded(true);
  };

  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden rounded-md bg-paper-2 ring-1 ring-black/5 ${!failed && !loaded ? "skeleton" : ""} ${className}`}
      style={
        failed
          ? { background: `linear-gradient(160deg, ${from}, ${to})` }
          : undefined
      }
    >
      {failed ? (
        <div className="flex h-full flex-col justify-end p-3">
          <span className="font-display text-lg font-semibold leading-tight text-white drop-shadow sm:text-xl">
            {title}
          </span>
          {year ? <span className="text-xs text-white/70">{year}</span> : null}
        </div>
      ) : (
        // Plain <img>: covers are hot-linked exactly as the library's own site does.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={`Cover of ${title}`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          // Images can finish before hydration attaches onLoad, so also check on mount.
          ref={(img) => {
            if (img?.complete) check(img);
          }}
          onLoad={(e) => check(e.currentTarget)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
