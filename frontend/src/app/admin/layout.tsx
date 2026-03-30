"use client";
import { useEffect, useState } from "react";
import { GHN_EMAIL_REGEX } from "@/lib/constants";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const email = sessionStorage.getItem("qc_user_email");
    if (!email || !GHN_EMAIL_REGEX.test(email)) {
      sessionStorage.removeItem("qc_user_email");
      window.location.href = "/";
      return;
    }
    setAllowed(true);
  }, []);

  if (!allowed) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 border-b border-gray-200 pb-4">
        <a href="/admin" className="text-sm font-medium text-gray-700 hover:text-red-600">Queue</a>
        <a href="/admin/knowledge-base" className="text-sm font-medium text-gray-700 hover:text-red-600">Knowledge Base</a>
        <span className="ml-auto text-xs text-gray-400">Admin View</span>
      </div>
      {children}
    </div>
  );
}
