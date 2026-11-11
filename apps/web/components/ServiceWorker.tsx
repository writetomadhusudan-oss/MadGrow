"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that lets MadGrow be installed and opened as an
 * app. Deferred until after load so it never competes with first paint; a
 * failure stays silent because the site works the same without it.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
