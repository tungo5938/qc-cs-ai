"use client";
import { useEffect, useState } from "react";
import { GHN_EMAIL_REGEX } from "@/lib/constants";

const PM_QC_EMAILS = (process.env.NEXT_PUBLIC_PM_QC_EMAILS || "").split(",").map(e => e.trim().toLowerCase());

function isAdmin(email: string | null): boolean {
  if (!email) return false;
  return PM_QC_EMAILS.includes(email.toLowerCase());
}

export default function NavBar() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("qc_user_email");
    if (stored && GHN_EMAIL_REGEX.test(stored)) setEmail(stored);
  }, []);

  const admin = isAdmin(email);

  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">Q</span>
          </div>
          <span className="font-semibold text-gray-900">QC CS AI</span>
        </a>
        <div className="flex items-center gap-4 text-sm">
          <a href="/" className="text-gray-600 hover:text-gray-900">Issues</a>
          {admin && (
            <a href="/admin" className="text-gray-600 hover:text-gray-900 font-medium">
              Admin
            </a>
          )}
          <a href="/submit" className="bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition">
            Report
          </a>
          {email && (
            <span className="text-xs text-gray-400 hidden sm:block">{email}</span>
          )}
        </div>
      </div>
    </nav>
  );
}
