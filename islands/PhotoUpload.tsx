// Island for uploading, viewing, reordering, and removing item photos
import { useSignal } from "@preact/signals";

interface PhotoUploadProps {
  itemId: string;
  photoIds: string[];
  csrfToken: string;
}

const MAX_PHOTOS = 5;
const MAX_DIM = 600;
const JPEG_QUALITY = 0.82;

async function resizeImage(
  file: File,
): Promise<{ blob: Blob; previewDataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) {
            height = Math.round((height / width) * MAX_DIM);
            width = MAX_DIM;
          } else {
            width = Math.round((width / height) * MAX_DIM);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        const previewDataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        canvas.toBlob(
          (blob) => blob ? resolve({ blob, previewDataUrl }) : reject(new Error("toBlob failed")),
          "image/jpeg",
          JPEG_QUALITY,
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function PhotoUpload({ itemId, photoIds: initialPhotoIds, csrfToken }: PhotoUploadProps) {
  const photoIds = useSignal<string[]>(initialPhotoIds);
  const activeIndex = useSignal(0);
  const pendingPreview = useSignal<string | null>(null);
  const pendingBlob = useSignal<Blob | null>(null);
  const uploading = useSignal(false);
  const status = useSignal<{ message: string; ok: boolean } | null>(null);

  const showStatus = (message: string, ok: boolean) => {
    status.value = { message, ok };
    setTimeout(() => { status.value = null; }, 4000);
  };

  const handleFileChange = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = "";
    status.value = null;
    try {
      const { blob, previewDataUrl } = await resizeImage(file);
      pendingPreview.value = previewDataUrl;
      pendingBlob.value = blob;
    } catch {
      showStatus("Could not load image — please try a different file", false);
    }
  };

  const handleUpload = async () => {
    const blob = pendingBlob.value;
    if (!blob) return;
    uploading.value = true;
    try {
      const form = new FormData();
      form.append("photo", blob, "photo.jpg");
      const res = await fetch(`/api/items/${itemId}/photos`, {
        method: "POST",
        headers: { "X-CSRF-Token": csrfToken },
        body: form,
      });
      if (res.ok) {
        const { photoId } = await res.json();
        photoIds.value = [...photoIds.value, photoId];
        activeIndex.value = photoIds.value.length - 1;
        pendingPreview.value = null;
        pendingBlob.value = null;
        showStatus("Photo added", true);
      } else {
        const body = await res.json().catch(() => ({}));
        showStatus(body.error ?? "Upload failed", false);
      }
    } catch {
      showStatus("Network error — could not upload photo", false);
    } finally {
      uploading.value = false;
    }
  };

  const handleRemove = async (photoId: string) => {
    if (!globalThis.confirm("Remove this photo? This cannot be undone.")) return;
    uploading.value = true;
    try {
      const res = await fetch(`/api/items/${itemId}/photos/${photoId}`, {
        method: "DELETE",
        headers: { "X-CSRF-Token": csrfToken },
      });
      if (res.ok) {
        const next = photoIds.value.filter((p) => p !== photoId);
        photoIds.value = next;
        activeIndex.value = Math.min(activeIndex.value, Math.max(0, next.length - 1));
        showStatus("Photo removed", true);
      } else {
        showStatus("Failed to remove photo", false);
      }
    } catch {
      showStatus("Network error — could not remove photo", false);
    } finally {
      uploading.value = false;
    }
  };

  const handleMove = async (fromIdx: number, toIdx: number) => {
    const next = [...photoIds.value];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    photoIds.value = next;
    activeIndex.value = toIdx;
    try {
      await fetch(`/api/items/${itemId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ photoIds: next }),
      });
    } catch {
      showStatus("Could not save new order", false);
    }
  };

  const canAddMore = photoIds.value.length < MAX_PHOTOS;

  return (
    <div class="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
          Photos
        </h3>
        <span class="text-xs text-gray-400 dark:text-gray-500">
          {photoIds.value.length} / {MAX_PHOTOS}
        </span>
      </div>

      {status.value && (
        <div
          class={`mb-3 px-4 py-2 rounded-md text-sm font-medium ${
            status.value.ok
              ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
              : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {status.value.ok ? "✓" : "✕"} {status.value.message}
        </div>
      )}

      {/* Pending preview */}
      {pendingPreview.value && (
        <div class="mb-4">
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Preview — not yet saved</p>
          <img
            src={pendingPreview.value}
            alt="Preview"
            class="max-w-xs rounded-lg border border-purple-300 dark:border-purple-700 shadow-sm object-contain"
            style="max-height: 240px"
          />
          <div class="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading.value}
              class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md disabled:opacity-50 transition-colors"
            >
              {uploading.value ? "Saving…" : "Save Photo"}
            </button>
            <button
              type="button"
              onClick={() => { pendingPreview.value = null; pendingBlob.value = null; }}
              disabled={uploading.value}
              class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing photos */}
      {photoIds.value.length > 0 && !pendingPreview.value && (
        <div class="mb-4">
          {/* Large view */}
          <img
            src={`/api/items/${itemId}/photos/${photoIds.value[activeIndex.value]}`}
            alt={`Photo ${activeIndex.value + 1}`}
            // @ts-ignore: fetchpriority is a valid HTML attribute not yet in Preact stubs
            fetchpriority="high"
            class="max-w-sm w-full rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm object-contain mb-3"
            style="max-height: 280px"
          />

          {/* Thumbnail strip */}
          {photoIds.value.length > 1 && (
            <div class="flex flex-wrap gap-2 mb-3">
              {photoIds.value.map((pid, idx) => (
                <button
                  key={pid}
                  type="button"
                  onClick={() => activeIndex.value = idx}
                  class={`w-14 h-14 rounded border-2 overflow-hidden flex-shrink-0 transition-colors ${
                    idx === activeIndex.value
                      ? "border-purple-500"
                      : "border-gray-200 dark:border-gray-600 hover:border-purple-300"
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

          {/* Actions for active photo */}
          <div class="flex flex-wrap items-center gap-3">
            {activeIndex.value > 0 && (
              <button
                type="button"
                disabled={uploading.value}
                onClick={() => handleMove(activeIndex.value, activeIndex.value - 1)}
                class="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                ← Move left
              </button>
            )}
            {activeIndex.value < photoIds.value.length - 1 && (
              <button
                type="button"
                disabled={uploading.value}
                onClick={() => handleMove(activeIndex.value, activeIndex.value + 1)}
                class="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                Move right →
              </button>
            )}
            {activeIndex.value === 0 && photoIds.value.length > 1 && (
              <span class="text-xs text-purple-600 dark:text-purple-400 font-medium">
                ★ Primary photo
              </span>
            )}
            <button
              type="button"
              disabled={uploading.value}
              onClick={() => handleRemove(photoIds.value[activeIndex.value])}
              class="ml-auto px-3 py-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xs font-medium disabled:opacity-50 transition-colors"
            >
              {uploading.value ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      )}

      {/* Add photo button */}
      {canAddMore && !pendingPreview.value && (
        <div>
          <label class="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-purple-400 hover:text-purple-600 dark:hover:border-purple-500 dark:hover:text-purple-400 transition-colors">
            <span class="text-lg">📷</span>
            <span>{photoIds.value.length === 0 ? "Add a photo…" : "Add another photo…"}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="sr-only"
              onChange={handleFileChange}
            />
          </label>
          <p class="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
            JPEG, PNG or WebP · auto-resized to fit · max {MAX_PHOTOS}
          </p>
        </div>
      )}
    </div>
  );
}


