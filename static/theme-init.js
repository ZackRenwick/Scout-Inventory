(function () {
  const s = localStorage.getItem("theme");
  if (
    s === "dark" ||
    (!s && globalThis.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  }
})();
