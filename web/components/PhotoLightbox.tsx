'use client';

import { useEffect, useState } from 'react';

export function PhotoLightbox({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, urls.length - 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, urls.length]);

  if (urls.length === 0) return null;

  return (
    <>
      <div className="flex gap-2 flex-wrap mt-2">
        {urls.map((url, i) => (
          <img
            key={url}
            src={url}
            data-testid="photo-thumb"
            alt={`Photo ${i + 1}`}
            className="w-16 h-16 object-cover rounded cursor-pointer border border-gray-200 hover:border-gray-400"
            onClick={e => { e.stopPropagation(); setIndex(i); setOpen(true); }}
          />
        ))}
      </div>

      {open && (
        <div
          data-testid="lightbox"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setOpen(false)}
        >
          <div className="relative" onClick={e => e.stopPropagation()}>
            <img
              src={urls[index]}
              alt={`Photo ${index + 1} of ${urls.length}`}
              className="max-h-[80vh] max-w-[90vw] rounded shadow-xl"
            />
            <div
              data-testid="lightbox-counter"
              className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 rounded px-2 py-0.5"
            >
              {index + 1} of {urls.length}
            </div>
            {index > 0 && (
              <button
                onClick={() => setIndex(i => i - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-white bg-black/50 rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70"
              >
                ‹
              </button>
            )}
            {index < urls.length - 1 && (
              <button
                onClick={() => setIndex(i => i + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white bg-black/50 rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70"
              >
                ›
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
