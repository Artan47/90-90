"use client";
/** Remplace next/navigation : usePathname lit l'ancre de l'URL. */
import { useEffect, useState } from "react";

function current(): string {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw || raw === "/") return "/";
  return raw.replace(/\/+$/, "") || "/";
}

export function usePathname(): string {
  const [path, setPath] = useState("/");
  useEffect(() => {
    const sync = () => setPath(current());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return path;
}

export function useRouter() {
  return {
    push: (href: string) => {
      window.location.hash = `#${href}`;
    },
    back: () => window.history.back(),
    refresh: () => {},
  };
}

export function useSearchParams() {
  return new URLSearchParams();
}
