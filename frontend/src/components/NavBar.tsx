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

        <div className="flex items-center gap-2">
          {/* Product filter */}
          <div className="hidden sm:flex items-center gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
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

          {/* User menu */}
          {session && (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-8 h-8 rounded-full bg-red-100 text-red-700 font-semibold text-sm flex items-center justify-center hover:bg-red-200 transition"
                title={userEmail}
              >
                {userInitial}
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs font-medium text-gray-900 truncate">{userEmail}</p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                  >
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          )}

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
          {/* Mobile product filter */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mt-2">
            {PRODUCT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleProductChange(opt.id)}
                className={`flex-1 text-xs px-2 py-1 rounded-md font-medium transition ${
                  productFilter === opt.id
                    ? "bg-white shadow text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
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
