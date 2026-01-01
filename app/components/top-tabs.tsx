"use client";

import { usePathname } from "next/navigation";

const items = [
  { href: "/template-studio", label: "Report Studio" },
  { href: "/runs", label: "Generate Reports" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function TopTabs() {
  const pathname = usePathname();

  return (
    <header className="top-tabs">
      <div className="top-tabs-inner">
        <a className="top-tabs-brand" href="/">
          Report Generator
        </a>
        <nav className="top-tabs-links">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`top-tab ${isActive(pathname, item.href) ? "active" : ""}`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
