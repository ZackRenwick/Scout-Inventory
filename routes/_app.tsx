import { type PageProps } from "$fresh/server.ts";
export default function App({ Component }: PageProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Scout troop inventory management — track gear, supplies, and equipment." />
        <title>scout-inventory</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.ico" />
        <link rel="preload" href="/styles.css" as="style" />
        <link rel="stylesheet" href="/styles.css" />
        <script>{`(function(){var s=localStorage.getItem("theme");if(s==="dark"||(!s&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}})()`}</script>
      </head>
      <body>
        <Component />
      </body>
    </html>
  );
}
