import { Head } from "$fresh/runtime.ts";

export default function Error404() {
  return (
    <>
      <Head>
        <title>404 - Page not found</title>
      </Head>
      <div class="px-4 py-8 mx-auto bg-purple-50">
        <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
          <div class="text-8xl my-6">⛺</div>
          <h1 class="text-4xl font-bold text-purple-900">404 - Page not found</h1>
          <p class="my-4 text-gray-600">
            The page you were looking for doesn't exist.
          </p>
          <a href="/" class="underline text-purple-700 hover:text-purple-900">Go back home</a>
        </div>
      </div>
    </>
  );
}
