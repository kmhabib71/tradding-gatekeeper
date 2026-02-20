"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/analyze", label: "Analyze" },
  { href: "/journal", label: "Journal" },
  { href: "/settings", label: "Settings" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    document.cookie = "gatekeeper_token=; path=/; max-age=0";
    router.push("/login");
  };

  return (
    <nav className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight">
              <span className="text-primary">GATE</span>
              <span className="text-foreground">KEEPER</span>
            </span>
          </Link>

          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  pathname === item.href
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-2"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
