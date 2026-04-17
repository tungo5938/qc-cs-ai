"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

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
  { href: "/documents", label: "Documents" },
  { href: "/settings", label: "Cài đặt" },
];

export default function NavBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [productFilter, setProductFilter] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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
      window.dispatchEvent(new StorageEvent("storage", { key: PRODUCT_FILTER_KEY, newValue: id }));
    }
  }

  const userEmail = session?.user?.email || "";
  const userInitial = userEmail.charAt(0).toUpperCase();

  return (
    <nav className="border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-900/40">
            <span className="text-white font-bold text-xs">PM</span>
          </div>
          <span className="font-semibold text-white hidden sm:block tracking-tight">GHN CS</span>
        </Link>

        {/* Nav links (desktop) */}
        <div className="hidden md:flex items-center gap-0.5 text-sm flex-1">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  active
                    ? "bg-red-600/20 text-red-400 ring-1 ring-red-600/30"
                    : "text-gray-400 hover:text-gray-100 hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Product filter */}
          <div className="hidden sm:flex items-center gap-0.5 bg-gray-800 rounded-lg p-1 shrink-0 ring-1 ring-gray-700">
            {PRODUCT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleProductChange(opt.id)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                  productFilter === opt.id
                    ? "bg-gray-700 text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* User menu */}
          {session && (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-8 h-8 rounded-full bg-red-600/20 text-red-400 font-semibold text-sm flex items-center justify-center hover:bg-red-600/30 transition-colors ring-1 ring-red-600/30"
                title={userEmail}
              >
                {userInitial}
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-gray-800 rounded-xl shadow-xl border border-gray-700 py-1 z-20">
                  <div className="px-4 py-2 border-b border-gray-700">
                    <p className="text-xs font-medium text-gray-200 truncate">{userEmail}</p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-600/10 transition-colors"
                  >
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mobile menu button */}
          <button
            className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-800 bg-gray-900 px-4 pb-3 space-y-1">
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
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-red-600/20 text-red-400"
                    : "text-gray-400 hover:text-gray-100 hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {/* Mobile product filter */}
          <div className="flex items-center gap-0.5 bg-gray-800 rounded-lg p-1 mt-2 ring-1 ring-gray-700">
            {PRODUCT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleProductChange(opt.id)}
                className={`flex-1 text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                  productFilter === opt.id
                    ? "bg-gray-700 text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Close user menu on outside click */}
      {userMenuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
      )}
    </nav>
  );
}
