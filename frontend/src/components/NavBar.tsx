"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const PRODUCT_FILTER_KEY = "pm_product_filter";

export const PRODUCT_OPTIONS = [
  { id: "", label: "Tất cả" },
  { id: "cs-ai", label: "CS AI" },
  { id: "cs-chat", label: "CS Chat" },
  { id: "voice-ai", label: "Voice AI" },
];

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/feedback", label: "Phản hồi" },
  { href: "/solutions", label: "Solutions" },
  { href: "/meetings", label: "Meetings" },
  { href: "/actions", label: "Actions" },
  { href: "/settings", label: "Cài đặt" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [productFilter, setProductFilter] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(PRODUCT_FILTER_KEY) || "";
      setProductFilter(stored);
    }
  }, []);

  function handleProductChange(id: string) {
    setProductFilter(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(PRODUCT_FILTER_KEY, id);
      // Dispatch storage event so other tabs/components can react
      window.dispatchEvent(new StorageEvent("storage", { key: PRODUCT_FILTER_KEY, newValue: id }));
    }
  }

  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">PM</span>
          </div>
          <span className="font-semibold text-gray-900 hidden sm:block">GHN CS</span>
        </Link>

        {/* Nav links (desktop) */}
        <div className="hidden md:flex items-center gap-1 text-sm flex-1">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg transition font-medium ${
                  active
                    ? "bg-red-50 text-red-600"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Product filter */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
          {PRODUCT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleProductChange(opt.id)}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition ${
                productFilter === opt.id
                  ? "bg-white shadow text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-1 rounded text-gray-500 hover:text-gray-700"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 pb-3 space-y-1">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                  active ? "bg-red-50 text-red-600" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
