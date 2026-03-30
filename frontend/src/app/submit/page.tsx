"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import EmailGate from "@/components/EmailGate";
import { Upload, X } from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function SubmitPage() {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", description: "", type: "bug" });
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected]);
    selected.forEach((f) => {
      const url = URL.createObjectURL(f);
      setPreviews((prev) => [...prev, url]);
    });
  };

  const removeFile = (i: number) => {
    setFiles((prev) => prev.filter((_, j) => j !== i));
    setPreviews((prev) => prev.filter((_, j) => j !== i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setError("Title and description are required");
      return;
    }
    const email = sessionStorage.getItem("qc_user_email");
    if (!email) { setError("Please refresh and enter your email"); return; }
    setSubmitting(true);
    try {
      // Upload files to backend
      const mediaUrls: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`${BASE}/api/upload`, {
          method: "POST",
          headers: { "X-User-Email": email },
          body: fd,
        });
        const data = await res.json();
        if (data.url) mediaUrls.push(data.url);
      }
      await api.issues.create({ ...form, media_urls: mediaUrls, submitted_by_email: email });
      router.push("/?submitted=1");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <EmailGate>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Report a Bug or Request a Feature</h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <div className="flex gap-3">
              {["bug", "feature_request"].map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={form.type === t}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className="accent-red-600"
                  />
                  <span className="text-sm">{t === "bug" ? "🐛 Bug" : "✨ Feature Request"}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Short description of the issue"
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 h-32 resize-none"
              placeholder="Steps to reproduce, expected vs actual behavior..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Attachments (images/video)</label>
            <label className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-4 py-6 cursor-pointer hover:border-red-400 transition justify-center">
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">Click to upload</span>
              <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
            </label>
            {previews.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {previews.map((url, i) => (
                  <div key={i} className="relative">
                    {files[i]?.type.startsWith("video/") ? (
                      <video src={url} className="w-20 h-20 object-cover rounded-lg" />
                    ) : (
                      <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-red-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
            <button type="button" onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5">
              Cancel
            </button>
          </div>
        </form>
        <p className="text-xs text-gray-400 mt-4">Your submission will be reviewed by the QC team before going public.</p>
      </div>
    </EmailGate>
  );
}
