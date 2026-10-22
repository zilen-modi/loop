"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { applyTheme, settings } from "@/lib/settings";

const links = [
  { href: "/", label: "Library" },
  { href: "/problems", label: "Problems" },
  { href: "/practice", label: "Practice" },
];

export default function TopBar() {
  const path = usePathname();
  const theme = settings.use().theme;
  useEffect(() => applyTheme(theme), [theme]);
  return (
    <header className="topbar">
      <div className="wrap">
        <Link href="/" className="wordmark">Loop</Link>
        <span style={{ color: "var(--ink-3)", fontSize: 13 }}>zero to offer</span>
        <nav className="navlinks" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={(l.href === "/" ? path === "/" : path.startsWith(l.href)) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
