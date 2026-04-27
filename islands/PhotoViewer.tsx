// Compact thumbnail strip — click any thumbnail to open a full-screen lightbox.
import ImageLightbox from "../components/ImageLightbox.tsx";

interface PhotoViewerProps {
  itemId: string;
  photoIds: string[];
}

export default function PhotoViewer({ itemId, photoIds }: PhotoViewerProps) {
  if (photoIds.length === 0) return null;

  const images = photoIds.map((pid, idx) => ({
    src: `/api/items/${itemId}/photos/${pid}`,
    alt: `Photo ${idx + 1} of ${photoIds.length}`,
    loading: idx === 0 ? undefined : "lazy" as const,
    fetchPriority: idx === 0 ? "high" as const : undefined,
  }));

  return (
    <div class="mb-4">
      <ImageLightbox
        images={images}
        ariaLabel="Item photos"
        listClass="flex flex-wrap gap-2"
        listRoleLabel="Item photos"
        buttonClass="w-16 h-16 rounded-lg border-2 border-gray-200 dark:border-gray-600 overflow-hidden flex-shrink-0 hover:border-purple-400 dark:hover:border-purple-500 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
        imageClass="w-full h-full object-cover"
        dialogImageClass="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
      />
    </div>
  );
}
