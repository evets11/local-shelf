"use client";

import { Clapperboard, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
  title: string;
  /** Known YouTube id; when missing we link to a YouTube search instead. */
  youtubeId: string | null;
  searchUrl: string;
}

/** "Play trailer" button that opens a privacy-enhanced YouTube player in its own modal. */
export function TrailerButton({ title, youtubeId, searchUrl }: Props) {
  const [playing, setPlaying] = useState(false);

  if (!youtubeId) {
    return (
      <a
        href={searchUrl}
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2.5 font-semibold text-ink transition hover:border-sea hover:text-sea"
      >
        <Clapperboard className="h-5 w-5" /> Find trailer
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 font-semibold text-paper transition hover:bg-ink/85"
      >
        <Play className="h-4 w-4 fill-current" /> Play trailer
      </button>
      {playing && (
        <TrailerDialog
          title={title}
          youtubeId={youtubeId}
          onClose={() => setPlaying(false)}
        />
      )}
    </>
  );
}

function TrailerDialog({
  title,
  youtubeId,
  onClose,
}: {
  title: string;
  youtubeId: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const d = dialog.current;
    const f = frame.current;
    // A second modal dialog stacks above the title dialog in the top layer, so it gets
    // Escape and focus on its own and nothing behind it scrolls.
    d?.showModal();
    return () => {
      // Next can hide (not unmount) the route this lives in, and a hidden iframe keeps
      // playing audio. Blank it out so playback always stops with the dialog.
      if (f) f.src = "about:blank";
      d?.close();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-label={`${title} trailer`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) dialog.current?.close();
      }}
      className="m-auto w-[min(92vw,64rem)] max-w-none overflow-visible bg-transparent p-0 backdrop:bg-black/85"
    >
      <div className="relative pt-12">
        <button
          type="button"
          aria-label="Close trailer"
          onClick={() => dialog.current?.close()}
          className="absolute right-0 top-0 grid h-10 w-10 place-items-center rounded-full bg-white text-black shadow"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="aspect-video overflow-hidden rounded-xl bg-black shadow-2xl">
          <iframe
            ref={frame}
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?autoplay=1&rel=0`}
            title={`${title} trailer`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      </div>
    </dialog>
  );
}
