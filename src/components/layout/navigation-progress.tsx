"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

// A slim top-of-viewport progress bar that runs while the user navigates
// between pages. App Router has no router events, so we start the bar on
// internal link clicks and complete it when the pathname actually changes.
export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Navigation finished once the pathname updates — complete + hide the bar.
  // Adjusting state during render (the React-recommended pattern for "reset on
  // prop change") rather than in an effect avoids an extra commit. Any pending
  // safety timeout that fires later just re-hides an already-hidden bar.
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (active) setActive(false);
  }

  useEffect(() => {
    const start = () => {
      setActive(true);
      if (timeout.current) clearTimeout(timeout.current);
      // Safety net: hide the bar if a navigation never resolves.
      timeout.current = setTimeout(() => setActive(false), 8000);
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      if (!href || target === "_blank") return;
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      )
        return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same page (or hash on the same page) — no navigation to indicate.
      if (url.pathname === window.location.pathname) return;

      start();
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="nav-progress"
          className="fixed top-0 left-0 right-0 z-[60] h-0.5 bg-coral origin-left shadow-[0_0_10px_rgba(233,69,96,0.7)]"
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 0.9 }}
          exit={{ scaleX: 1, opacity: 0 }}
          transition={{
            scaleX: { duration: 6, ease: "easeOut" },
            opacity: { duration: 0.2, ease: "easeOut" },
          }}
        />
      )}
    </AnimatePresence>
  );
}
