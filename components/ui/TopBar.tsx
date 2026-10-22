"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { BookOpen, ListChecks, Repeat, Star } from "lucide-react";
import { applyTheme, settings } from "@/lib/settings";

const links = [
  { href: "/", label: "Library", short: "Library", Icon: BookOpen },
  { href: "/top", label: "Top questions", short: "Top", Icon: Star },
  { href: "/problems", label: "Problems", short: "Problems", Icon: ListChecks },
  { href: "/practice", label: "Practice", short: "Practice", Icon: Repeat },
];

export default function TopBar() {
  const path = usePathname();
  const theme = settings.use().theme;
  useEffect(() => applyTheme(theme), [theme]);
  return (
    <header className="topbar">
      <div className="wrap">
        <Link href="/" className="wordmark">Loop</Link>
        <span className="tagline">zero to offer</span>
        <nav className="navlinks" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={(l.href === "/" ? path === "/" : path.startsWith(l.href)) ? "page" : undefined}>
              <l.Icon size={20} aria-hidden="true" />
              <span className="long">{l.label}</span>
              <span className="short" aria-hidden="true">{l.short}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
