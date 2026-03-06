import { HttpError, type PageProps } from "fresh";

export default function ErrorPage(props: PageProps) {
  const error = props.error;
  const is404 = error instanceof HttpError && error.status === 404;

  if (is404) {
    return (
      <div class="px-4 py-8 mx-auto bg-purple-50">
        <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
          <div class="text-8xl my-6">⛺</div>
          <h1 class="text-4xl font-bold text-purple-900">
            404 - Page not found
          </h1>
          <p class="my-4 text-gray-600">
            The page you were looking for doesn't exist.
          </p>
          <a href="/" class="underline text-purple-700 hover:text-purple-900">
            Go back home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div class="px-4 py-8 mx-auto bg-red-50">
      <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
        <div class="text-8xl my-6">💥</div>
        <h1 class="text-4xl font-bold text-red-900">Something went wrong</h1>
        <p class="my-4 text-gray-600">
          An unexpected error occurred. Please try again.
        </p>
        {error instanceof Error && (
          <pre class="mt-2 text-xs bg-white p-4 rounded border text-red-700 max-w-full overflow-auto">
            {error.message}
          </pre>
        )}
        <a href="/" class="mt-4 underline text-red-700 hover:text-red-900">
          Go back home
        </a>
      </div>
    </div>
  );
}
