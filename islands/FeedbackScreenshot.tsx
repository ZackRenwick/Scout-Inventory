import ImageLightbox from "../components/ImageLightbox.tsx";

interface FeedbackScreenshotProps {
  src: string;
  alt: string;
}

export default function FeedbackScreenshot(
  { src, alt }: FeedbackScreenshotProps,
) {
  return (
    <ImageLightbox
      images={[{ src, alt }]}
      ariaLabel={alt}
      buttonClass="block w-full sm:w-auto text-left focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-lg"
      imageClass="block w-full max-w-full sm:max-w-md h-auto rounded-lg border border-gray-300 dark:border-gray-700 shadow-sm object-contain"
      imageStyle="max-height: min(60vh, 400px)"
      showCounter={false}
    />
  );
}
