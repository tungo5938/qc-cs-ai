"use client";
import { useState, useEffect } from "react";
import { GHN_EMAIL_REGEX } from "@/lib/constants";

interface Props {
  children: React.ReactNode;
}

export default function EmailGate({ children }: Props) {
  const [email, setEmail] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem("qc_user_email");
    if (stored) setEmail(stored);
    setLoading(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim().toLowerCase();
    if (!GHN_EMAIL_REGEX.test(trimmed)) {
      setError("Vui lòng nhập email @ghn.vn hoặc @ghn.com.vn hợp lệ");
      return;
    }
    sessionStorage.setItem("qc_user_email", trimmed);
    setEmail(trimmed);
  };

  if (loading) return null;

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">
          <div className="mb-6">
            <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center mb-4">
              <span className="text-white font-bold text-xl">Q</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">QC CS AI</h1>
            <p className="text-gray-500 text-sm mt-1">Nhập email GHN của bạn để tiếp tục</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="email"
                value={input}
                onChange={(e) => { setInput(e.target.value); setError(""); }}
                placeholder="tenban@ghn.vn"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                autoFocus
              />
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>
            <button
              type="submit"
              className="w-full bg-red-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-red-700 transition"
            >
              Tiếp tục
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
