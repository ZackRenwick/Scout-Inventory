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
        function activateWaitingWorker() {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        }

        if (reg.waiting) {
          activateWaitingWorker();
        }

        reg.addEventListener("updatefound", function () {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", function () {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              activateWaitingWorker();
            }
          });
        });

        let reloading = false;
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          function () {
            if (reloading) return;
            reloading = true;
            globalThis.location.reload();
          },
        );

        reg.update();
      });
  });
}
