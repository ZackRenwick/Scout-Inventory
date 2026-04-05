// Compact thumbnail strip — click any thumbnail to open a full-screen lightbox.
import { useSignal } from "@preact/signals";

interface PhotoViewerProps {
  itemId: string;
  photoIds: string[];
}

export default function PhotoViewer({ itemId, photoIds }: PhotoViewerProps) {
  const lightboxIdx = useSignal<number | null>(null);

  if (photoIds.length === 0) return null;

  const open = (idx: number) => { lightboxIdx.value = idx; };
  const close = () => { lightboxIdx.value = null; };
  const prev = () => { lightboxIdx.value = (lightboxIdx.value! - 1 + photoIds.length) % photoIds.length; };
  const next = () => { lightboxIdx.value = (lightboxIdx.value! + 1) % photoIds.length; };

  const handleKey = (e: KeyboardEvent) => {
    if (lightboxIdx.value === null) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") prev();
    else if (e.key === "ArrowRight") next();
  };

  return (
    <div class="mb-4">
      {/* Thumbnail strip */}
      <div class="flex flex-wrap gap-2" role="list" aria-label="Item photos">
        {photoIds.map((pid, idx) => (
          <button
            key={pid}
            type="button"
            role="listitem"
            onClick={() => open(idx)}
            title={`View photo ${idx + 1} of ${photoIds.length}`}
            class="w-16 h-16 rounded-lg border-2 border-gray-200 dark:border-gray-600 overflow-hidden flex-shrink-0 hover:border-purple-400 dark:hover:border-purple-500 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <img
              src={`/api/items/${itemId}/photos/${pid}`}
              alt={`Photo ${idx + 1}`}
              loading={idx === 0 ? undefined : "lazy"}
              // @ts-ignore: fetchpriority is a valid HTML attribute not yet in Preact stubs
              fetchpriority={idx === 0 ? "high" : undefined}
              class="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIdx.value !== null && (
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={close}
          onKeyDown={handleKey}
          // deno-lint-ignore jsx-a11y/no-noninteractive-element-interactions
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${lightboxIdx.value + 1} of ${photoIds.length}`}
          // deno-lint-ignore jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          // auto-focus the overlay so keyboard events work immediately
          ref={(el) => el?.focus()}
        >
          {/* Close */}
          <button
            type="button"
            class="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none font-light z-10 focus:outline-none"
            onClick={(e) => { e.stopPropagation(); close(); }}
            aria-label="Close"
          >
            ✕
          </button>

          {/* Prev */}
          {photoIds.length > 1 && (
            <button
              type="button"
              class="absolute left-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-4xl leading-none z-10 focus:outline-none px-2"
              onClick={(e) => { e.stopPropagation(); prev(); }}
              aria-label="Previous photo"
            >
              ‹
            </button>
          )}

          {/* Image */}
          <img
            src={`/api/items/${itemId}/photos/${photoIds[lightboxIdx.value]}`}
            alt={`Photo ${lightboxIdx.value + 1} of ${photoIds.length}`}
            class="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next */}
          {photoIds.length > 1 && (
            <button
              type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-4xl leading-none z-10 focus:outline-none px-2"
              onClick={(e) => { e.stopPropagation(); next(); }}
              aria-label="Next photo"
            >
              ›
          </button>
          )}

          {/* Counter */}
          {photoIds.length > 1 && (
            <div class="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm tabular-nums">
              {lightboxIdx.value + 1} / {photoIds.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
