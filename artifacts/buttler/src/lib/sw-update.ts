/**
 * Service Worker auto-update utility.
 *
 * Responsibilities:
 *  1. When the SW controller changes (new SW activated after skipWaiting),
 *     show a brief "Updating…" toast and reload the page after 1.5 s so
 *     users always run the latest code.
 *  2. Poll registration.update() every 60 minutes so long-lived sessions
 *     still discover deploys.
 *  3. Call registration.update() whenever the tab becomes visible again
 *     (covers the "phone in pocket / laptop lid open" case).
 *
 * The module is intentionally side-effect free until you call
 * `initSWAutoUpdate()`.  It never throws — all errors are swallowed so
 * a broken SW path cannot crash the React app.
 */

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

export function initSWAutoUpdate(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // ── 1. Reload on controller change ────────────────────────────────────────
  // skipWaiting() + clients.claim() in the SW means a new controller arrives
  // as soon as the new SW installs.  We detect that here and reload so the
  // tab switches to the freshly pre-cached bundle.
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return; // guard against double-fire
    reloading = true;
    showUpdateToast(() => {
      window.location.reload();
    });
  });

  // ── 2 & 3. Periodic + visibility-triggered update checks ──────────────────
  navigator.serviceWorker.ready
    .then((registration) => {
      // Poll every 60 minutes
      const intervalId = setInterval(() => {
        registration.update().catch(() => {
          /* ignore — offline or fetch error */
        });
      }, UPDATE_CHECK_INTERVAL_MS);

      // Also check whenever the document becomes visible
      const onVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          registration.update().catch(() => {
            /* ignore */
          });
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);

      // Clean up if the module is ever torn down (e.g., hot reload in dev)
      if (import.meta.hot) {
        import.meta.hot.dispose(() => {
          clearInterval(intervalId);
          document.removeEventListener("visibilitychange", onVisibilityChange);
        });
      }
    })
    .catch(() => {
      /* SW registration not ready — ignore */
    });
}

// ── Toast helper ──────────────────────────────────────────────────────────────
// Appends a lightweight, self-removing DOM toast.  No React dependency so it
// works even if the React tree hasn't mounted yet (or has unmounted).

function showUpdateToast(onDone: () => void): void {
  // Avoid duplicates
  if (document.getElementById("buttler-update-toast")) {
    setTimeout(onDone, 1500);
    return;
  }

  const toast = document.createElement("div");
  toast.id = "buttler-update-toast";

  Object.assign(toast.style, {
    position: "fixed",
    bottom: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "999999",
    background: "rgba(17,24,39,0.93)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: "600",
    fontFamily: "system-ui, sans-serif",
    padding: "10px 20px",
    borderRadius: "10px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.28)",
    whiteSpace: "nowrap",
    pointerEvents: "none",
    opacity: "0",
    transition: "opacity 0.2s ease",
  });

  toast.textContent = "✦ New version available — updating…";
  document.body.appendChild(toast);

  // Fade in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
    });
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    onDone();
  }, 1500);
}
