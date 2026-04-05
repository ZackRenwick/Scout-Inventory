// Read-only photo viewer island: click any thumbnail to display it large.
import { useSignal } from "@preact/signals";

interface PhotoViewerProps {
  itemId: string;
  photoIds: string[];
}

export default function PhotoViewer({ itemId, photoIds }: PhotoViewerProps) {
  const activeIdx = useSignal(0);

  if (photoIds.length === 0) return null;

  const activeSrc = `/api/items/${itemId}/photos/${photoIds[activeIdx.value]}`;

  return (
    <div class="mb-6">
      {/* Large view */}
      <img
        src={activeSrc}
        alt={`Photo ${activeIdx.value + 1} of ${photoIds.length}`}
        // @ts-ignore: fetchpriority is a valid HTML attribute not yet in Preact stubs
        fetchpriority="high"
        class="max-w-sm w-full rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm object-contain mb-3"
        style="max-height: 320px"
      />

      {/* Thumbnail strip */}
      {photoIds.length > 1 && (
        <div class="flex flex-wrap gap-2">
          {photoIds.map((pid, idx) => (
            <button
              key={pid}
              type="button"
              onClick={() => activeIdx.value = idx}
              title={`View photo ${idx + 1}`}
              class={`w-16 h-16 rounded border-2 overflow-hidden flex-shrink-0 transition-colors ${
                idx === activeIdx.value
                  ? "border-purple-500"
                  : "border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-500"
              }`}
            >
              <img
                src={`/api/items/${itemId}/photos/${pid}`}
                alt={`Thumbnail ${idx + 1}`}
                loading="lazy"
                class="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
