"use client";
/**
 * Remplace next/link pour le build de prévisualisation : même API, mais
 * navigation par ancre (#/stays) au lieu du routeur de Next.
 */
import type { ReactNode, MouseEvent } from "react";

export default function Link({
  href,
  children,
  className,
  ...rest
}: {
  href: string;
  children: ReactNode;
  className?: string;
  [key: string]: unknown;
}) {
  const hash = `#${href.startsWith("/") ? href : `/${href}`}`;
  return (
    <a
      href={hash}
      className={className}
      onClick={(e: MouseEvent) => {
        e.preventDefault();
        window.location.hash = hash;
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
