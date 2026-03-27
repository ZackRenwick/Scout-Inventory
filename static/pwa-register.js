if ("serviceWorker" in navigator) {
  globalThis.addEventListener("load", function () {
    const host = globalThis.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";

    if (isLocal) {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        registrations.forEach(function (reg) {
          reg.unregister();
        });
      });
      if ("caches" in globalThis) {
        caches.keys().then(function (keys) {
          keys.forEach(function (key) {
            caches.delete(key);
          });
        });
      }
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then(function (reg) {
        reg.update();
      });
  });
}
