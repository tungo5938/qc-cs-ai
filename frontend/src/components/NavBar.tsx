"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const PRODUCT_FILTER_KEY = "pm_product_filter";

export const PRODUCT_OPTIONS = [
  { id: "", label: "Tất cả" },
  { id: "cs-ai", label: "CS AI" },
  { id: "cs-chat", label: "CS Chat" },
  { id: "voice-ai", label: "Voice AI" },
];

const NAV_LINKS = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/feedback",
    label: "Phản hồi",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  {
    href: "/roadmap",
    label: "Roadmap",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    href: "/meetings",
    label: "Meetings",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/actions",
    label: "Actions",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/documents",
    label: "Documents",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Cài đặt",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function NavBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [productFilter, setProductFilter] = useState<string>("");
  const [productOptions, setProductOptions] = useState<{ id: string; label: string }[]>([
    { id: "", label: "Tất cả" },
  ]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(PRODUCT_FILTER_KEY) || "";
    setProductFilter(stored);

    const CACHE_KEY = "pm_products_cache";
    const CACHE_TTL = 30_000; // 30 seconds
    const cached = localStorage.getItem(CACHE_KEY);
    let cachedProducts: any[] | null = null;
    if (cached) {
      try {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) cachedProducts = data;
      } catch {}
    }

    function applyProducts(products: any[]) {
      const opts = [
        { id: "", label: "Tất cả" },
        ...products.map((p) => ({ id: p.id, label: p.name })),
      ];
      setProductOptions(opts);
      if (stored && stored.split("-").length !== 5) {
        const matched = products.find(
          (p) => p.name.toLowerCase().replace(/\s+/g, "-") === stored
        );
        if (matched) {
          localStorage.setItem(PRODUCT_FILTER_KEY, matched.id);
          setProductFilter(matched.id);
          window.dispatchEvent(
            new StorageEvent("storage", { key: PRODUCT_FILTER_KEY, newValue: matched.id })
          );
        }
      }
    }

    if (cachedProducts) {
      applyProducts(cachedProducts);
    } else {
      fetch("/proxy/api/products")
        .then((r) => r.json())
        .then((products: any[]) => {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: products }));
          applyProducts(products);
        })
        .catch(() => {});
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
  const activeProduct = productOptions.find((o) => o.id === productFilter);

  return (
    <aside className="w-52 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col h-screen sticky top-0 z-10">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-800">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-900/40 shrink-0">
            <span className="text-white font-bold text-xs">PM</span>
          </div>
          <span className="font-semibold text-white tracking-tight text-sm">GHN CS</span>
        </Link>
      </div>

      {/* Product filter */}
      <div className="px-3 py-3 border-b border-gray-800">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Sản phẩm</p>
        <div className="space-y-0.5">
          {productOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleProductChange(opt.id)}
              className={`w-full text-left text-sm px-2.5 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                productFilter === opt.id
                  ? "bg-red-600/15 text-red-400 ring-1 ring-red-600/20"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              {opt.id === "" ? (
                <span className="w-2 h-2 rounded-full bg-gray-500 shrink-0" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              )}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Menu</p>
        {NAV_LINKS.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-red-600/15 text-red-400 ring-1 ring-red-600/20"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              {link.icon}
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      {session && (
        <div className="px-3 py-3">
          <Separator className="mb-3 bg-gray-800" />
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/5 transition-colors group"
            >
              <Avatar className="w-7 h-7 shrink-0">
                <AvatarFallback className="bg-red-600/20 text-red-400 text-xs font-semibold ring-1 ring-red-600/30">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-gray-300 truncate">{userEmail.split("@")[0]}</p>
                <p className="text-[10px] text-gray-500 truncate">@{userEmail.split("@")[1]}</p>
              </div>
              <svg className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 rounded-xl shadow-xl border border-gray-700 py-1 z-20">
                  <div className="px-3 py-2 border-b border-gray-700">
                    <p className="text-xs text-gray-400 truncate">{userEmail}</p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-600/10 transition-colors"
                  >
                    Đăng xuất
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
