"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";

export default function NewFeedbackPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.products.list().then((r) => {
      setProducts(r as Product[]);
      if ((r as Product[]).length > 0) setProductId((r as Product[])[0].id);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const fb = await api.feedbacks.create({
        product_id: productId,
        raw_content: content.trim(),
        source: "manual",
      });
      router.push(`/feedback/${(fb as any).id}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <a href="/feedback" className="text-sm text-gray-500 hover:text-gray-700">
          ← Quay lại danh sách
        </a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Thêm feedback thủ công</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sản phẩm
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">-- Chọn sản phẩm --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nội dung feedback
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={6}
              placeholder="Nhập nội dung phản hồi..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !productId || !content.trim()}
            className="w-full bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Đang gửi..." : "Gửi feedback"}
          </button>
        </form>
      </div>
    </div>
  );
}
