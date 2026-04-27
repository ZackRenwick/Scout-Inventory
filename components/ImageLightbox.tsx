import { useSignal } from "@preact/signals";

interface LightboxImage {
  src: string;
  alt: string;
  thumbSrc?: string;
  thumbAlt?: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
}

interface ImageLightboxProps {
  images: LightboxImage[];
  ariaLabel: string;
  listClass?: string;
  listRoleLabel?: string;
  buttonClass: string;
  imageClass: string;
  imageStyle?: string;
  dialogImageClass?: string;
  showCounter?: boolean;
}

export default function ImageLightbox({
  images,
  ariaLabel,
  listClass = "",
  listRoleLabel,
  buttonClass,
  imageClass,
  imageStyle,
  dialogImageClass =
    "max-w-[92vw] max-h-[88vh] object-contain rounded-lg shadow-2xl",
  showCounter = true,
}: ImageLightboxProps) {
  const lightboxIdx = useSignal<number | null>(null);

  if (images.length === 0) return null;

  const open = (idx: number) => {
    lightboxIdx.value = idx;
  };

  const close = () => {
    lightboxIdx.value = null;
  };

  const prev = () => {
    lightboxIdx.value = (lightboxIdx.value! - 1 + images.length) %
      images.length;
  };

  const next = () => {
    lightboxIdx.value = (lightboxIdx.value! + 1) % images.length;
  };

  const handleKey = (e: KeyboardEvent) => {
    if (lightboxIdx.value === null) return;
    if (e.key === "Escape") close();
    else if (images.length > 1 && e.key === "ArrowLeft") prev();
    else if (images.length > 1 && e.key === "ArrowRight") next();
  };

  return (
    <>
      <div
        class={listClass}
        role={listRoleLabel ? "list" : undefined}
        aria-label={listRoleLabel ?? undefined}
      >
        {images.map((image, idx) => (
          <button
            key={`${image.src}-${idx}`}
            type="button"
            role={listRoleLabel ? "listitem" : undefined}
            onClick={() => open(idx)}
            title={`View image ${idx + 1} of ${images.length}`}
            class={buttonClass}
            aria-label={`Open ${image.alt}`}
          >
            <img
              src={image.thumbSrc ?? image.src}
              alt={image.thumbAlt ?? image.alt}
              loading={image.loading}
              // @ts-ignore: fetchpriority is a valid HTML attribute not yet in Preact stubs
              fetchpriority={image.fetchPriority}
              class={imageClass}
              style={imageStyle}
            />
          </button>
        ))}
      </div>

      {lightboxIdx.value !== null && (
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={close}
          onKeyDown={handleKey}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          tabIndex={0}
          ref={(el) => el?.focus()}
        >
          <button
            type="button"
            class="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none font-light z-10 focus:outline-none"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            aria-label="Close image viewer"
          >
            ✕
          </button>

          {images.length > 1 && (
            <button
              type="button"
              class="absolute left-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-4xl leading-none z-10 focus:outline-none px-2"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              aria-label="Previous image"
            >
              ‹
            </button>
          )}

          <img
            src={images[lightboxIdx.value].src}
            alt={images[lightboxIdx.value].alt}
            class={dialogImageClass}
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <button
              type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-4xl leading-none z-10 focus:outline-none px-2"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              aria-label="Next image"
            >
              ›
            </button>
          )}

          {showCounter && images.length > 1 && (
            <div class="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm tabular-nums">
              {lightboxIdx.value + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}
