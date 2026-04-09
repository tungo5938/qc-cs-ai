"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { ScoringConfig } from "@/lib/types";
import { TEAM_LABELS } from "@/lib/constants";

const TEAMS = ["cs_b2c", "cs_c2c", "telesales"] as const;

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<ScoringConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Local editable state
  const [weights, setWeights] = useState({
    user_rating_weight: 0.25,
    po_rating_weight: 0.35,
    csat_weight: 0.25,
    effort_weight: 0.15,
  });
  const [thresholds, setThresholds] = useState({
    threshold_medium: 3.5,
    threshold_high: 6.0,
    threshold_critical: 8.0,
  });
  const [poEmailInput, setPoEmailInput] = useState("");
  const [poEmails, setPoEmails] = useState<string[]>([]);
  const [teamRaters, setTeamRaters] = useState<Record<string, string>>({});
  const [teamRaterInputs, setTeamRaterInputs] = useState<Record<string, string>>({});
  const [savingRater, setSavingRater] = useState<string | null>(null);

  useEffect(() => {
    api.scoring.getConfig().then((cfg: ScoringConfig) => {
      setConfig(cfg);
      setWeights({
        user_rating_weight: cfg.user_rating_weight,
        po_rating_weight: cfg.po_rating_weight,
        csat_weight: cfg.csat_weight,
        effort_weight: cfg.effort_weight,
      });
      setThresholds({
        threshold_medium: cfg.threshold_medium,
        threshold_high: cfg.threshold_high,
        threshold_critical: cfg.threshold_critical,
      });
      setPoEmails(cfg.po_emails || []);
      setTeamRaters(cfg.team_raters || {});
      const inputs: Record<string, string> = {};
      TEAMS.forEach((t) => { inputs[t] = cfg.team_raters?.[t] || ""; });
      setTeamRaterInputs(inputs);
    });
  }, []);

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const saveConfig = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.scoring.updateConfig({ ...weights, ...thresholds, po_emails: poEmails });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const addPoEmail = () => {
    const email = poEmailInput.trim().toLowerCase();
    if (!email || poEmails.includes(email)) return;
    setPoEmails((prev) => [...prev, email]);
    setPoEmailInput("");
  };

  const removePoEmail = (email: string) => {
    setPoEmails((prev) => prev.filter((e) => e !== email));
  };

  const saveTeamRater = async (team: string) => {
    const email = teamRaterInputs[team]?.trim();
    if (!email) return;
    setSavingRater(team);
    try {
      await api.scoring.updateTeamRater(team, email);
      setTeamRaters((prev) => ({ ...prev, [team]: email }));
    } finally {
      setSavingRater(null);
    }
  };

  if (!config) return <div className="text-center py-12 text-gray-400">Đang tải...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Cài đặt hệ thống chấm điểm</h1>

      {/* Formula weights */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Trọng số công thức</h2>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${Math.abs(totalWeight - 1) < 0.001 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            Tổng: {(totalWeight * 100).toFixed(0)}%
          </span>
        </div>
        <p className="text-xs text-gray-500">Điểm tổng = (đánh giá người dùng × W1) + (đánh giá PO × W2) + (CSAT × W3) + ((11 − nỗ lực) × W4), chuẩn hóa theo thành phần có dữ liệu.</p>

        {[
          { key: "user_rating_weight", label: "Đánh giá người dùng" },
          { key: "po_rating_weight", label: "Đánh giá PO" },
          { key: "csat_weight", label: "CSAT (AI)" },
          { key: "effort_weight", label: "Nỗ lực kỹ thuật (đảo ngược)" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-4">
            <label className="text-sm text-gray-700 w-48">{label}</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={weights[key as keyof typeof weights]}
              onChange={(e) => setWeights((w) => ({ ...w, [key]: parseFloat(e.target.value) }))}
              className="flex-1"
            />
            <span className="text-sm font-medium text-gray-800 w-12 text-right">
              {(weights[key as keyof typeof weights] * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>

      {/* Priority thresholds */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Ngưỡng ưu tiên</h2>
        <p className="text-xs text-gray-500">Điểm từ 0–10. &lt; Trung bình = Thấp, &lt; Cao = Trung bình, &lt; Nghiêm trọng = Cao, ≥ Nghiêm trọng = Nghiêm trọng.</p>
        {[
          { key: "threshold_medium", label: "Ngưỡng Trung bình" },
          { key: "threshold_high", label: "Ngưỡng Cao" },
          { key: "threshold_critical", label: "Ngưỡng Nghiêm trọng" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-4">
            <label className="text-sm text-gray-700 w-48">{label}</label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={thresholds[key as keyof typeof thresholds]}
              onChange={(e) => setThresholds((t) => ({ ...t, [key]: parseFloat(e.target.value) }))}
              className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        ))}
      </div>

      <button
        onClick={saveConfig}
        disabled={saving}
        className="bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
      >
        {saving ? "Đang lưu..." : saved ? "✓ Đã lưu" : "Lưu cấu hình"}
      </button>

      {/* PO emails */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="font-semibold text-gray-900">Danh sách PO được phép chấm điểm</h2>
        <div className="flex flex-wrap gap-2">
          {poEmails.map((email) => (
            <span key={email} className="flex items-center gap-1 bg-blue-50 text-blue-800 text-xs px-2 py-1 rounded-full">
              {email}
              <button onClick={() => removePoEmail(email)} className="hover:text-red-600 ml-1">×</button>
            </span>
          ))}
          {poEmails.length === 0 && <span className="text-sm text-gray-400">Chưa có PO nào.</span>}
        </div>
        <div className="flex gap-2">
          <input
            value={poEmailInput}
            onChange={(e) => setPoEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPoEmail()}
            placeholder="email@ghn.vn"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            onClick={addPoEmail}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 transition"
          >
            Thêm
          </button>
        </div>
        <button
          onClick={() => api.scoring.updateConfig({ po_emails: poEmails }).then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000); })}
          className="text-sm text-blue-600 hover:underline"
        >
          Lưu danh sách PO
        </button>
      </div>

      {/* Team raters */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Người đánh giá theo team</h2>
        <p className="text-xs text-gray-500">Mỗi team có một người được phép gửi đánh giá người dùng (user rating).</p>
        {TEAMS.map((team) => (
          <div key={team} className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 w-28">{TEAM_LABELS[team]}</label>
            <input
              value={teamRaterInputs[team] || ""}
              onChange={(e) => setTeamRaterInputs((prev) => ({ ...prev, [team]: e.target.value }))}
              placeholder="email@ghn.vn"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button
              onClick={() => saveTeamRater(team)}
              disabled={savingRater === team}
              className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-900 disabled:opacity-50 transition"
            >
              {savingRater === team ? "..." : teamRaters[team] ? "Cập nhật" : "Lưu"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
