import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * On full page reload (F5 / refresh), send the user to home unless they are already on `/`.
 * Client-side navigation does not trigger this (navigation type is not "reload").
 */
function RefreshRedirectsToHome() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/") return;

    let isReload = false;
    try {
      const entries = performance.getEntriesByType("navigation");
      const nav = entries[0];
      if (nav && "type" in nav && nav.type === "reload") {
        isReload = true;
      }
    } catch {
      /* ignore */
    }

    if (!isReload && typeof performance !== "undefined" && performance.navigation) {
      // Deprecated but still used in some environments; 1 === TYPE_RELOAD
      try {
        if (performance.navigation.type === 1) isReload = true;
      } catch {
        /* ignore */
      }
    }

    if (isReload) {
      window.location.replace("/");
    }
  }, [location.pathname]);

  return null;
}

export default RefreshRedirectsToHome;
