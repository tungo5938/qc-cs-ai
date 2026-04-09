"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { use } from "react";
import { api } from "@/lib/api";
import type { Meeting, MeetingNote, ActionItem } from "@/lib/types";
import {
  MEETING_STATUS_LABELS,
  MEETING_STATUS_COLORS,
  MEETING_TYPE_LABELS,
  ACTION_STATUS_LABELS,
  ACTION_STATUS_COLORS,
} from "@/lib/constants";

export default function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ActionItem[] | null>(null);

  useEffect(() => {
    api.meetings
      .get(id)
      .then((r) => setMeeting(r as Meeting))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStartMeeting() {
    if (!meeting) return;
    try {
      const updated = await api.meetings.update(meeting.id, { status: "in_progress" });
      setMeeting(updated as Meeting);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleAddNote() {
    if (!meeting || !noteInput.trim()) return;
    setAddingNote(true);
    try {
      const note = await api.meetings.addNote(meeting.id, noteInput.trim());
      setMeeting({
        ...meeting,
        notes: [...(meeting.notes ?? []), note as MeetingNote],
      });
      setNoteInput("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAddingNote(false);
    }
  }

  async function handleFinish() {
    if (!meeting) return;
    setFinishing(true);
    try {
      const result = await api.meetings.finish(meeting.id);
      const r = result as any;
      setMeeting(r.meeting ?? { ...meeting, status: "done" });
      setExtractedItems(r.action_items ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setFinishing(false);
    }
  }

  if (loading)
    return <div className="py-16 text-center text-gray-400">Đang tải...</div>;
  if (error)
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700">{error}</div>
    );
  if (!meeting) return null;

  const notes: MeetingNote[] = meeting.notes ?? [];
  const actionItems: ActionItem[] = meeting.action_items ?? [];

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/meetings" className="text-sm text-gray-500 hover:text-gray-700">
        ← Quay lại danh sách
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {meeting.product_name && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
              {meeting.product_name}
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
            {MEETING_TYPE_LABELS[meeting.meeting_type] ?? meeting.meeting_type}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              MEETING_STATUS_COLORS[meeting.status] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            {MEETING_STATUS_LABELS[meeting.status] ?? meeting.status}
          </span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{meeting.name}</h1>
        <p className="text-sm text-gray-500">
          {new Date(meeting.scheduled_at).toLocaleString("vi-VN", {
            dateStyle: "full",
            timeStyle: "short",
          })}
        </p>
        {meeting.participants && meeting.participants.length > 0 && (
          <p className="text-sm text-gray-500 mt-1">
            Người tham dự: {meeting.participants.join(", ")}
          </p>
        )}

        <div className="mt-4 flex gap-3">
          {meeting.status === "upcoming" && (
            <button
              onClick={handleStartMeeting}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              Bắt đầu meeting
            </button>
          )}
          {meeting.status === "in_progress" && (
            <button
              onClick={handleFinish}
              disabled={finishing}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
            >
              {finishing ? "Đang kết thúc..." : "Kết thúc meeting"}
            </button>
          )}
        </div>
      </div>

      {/* Extracted action items (after finish) */}
      {extractedItems && extractedItems.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <h2 className="font-semibold text-green-900 mb-3">
            Action items được trích xuất ({extractedItems.length})
          </h2>
          <ul className="space-y-2">
            {extractedItems.map((item) => (
              <li key={item.id} className="text-sm text-green-800">
                • {item.title} — <span className="font-medium">{item.assignee}</span>
              </li>
            ))}
          </ul>
          <Link href="/actions" className="text-xs text-green-700 hover:underline mt-3 block">
            Xem tất cả action items →
          </Link>
        </div>
      )}

      {/* Notes */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Ghi chú</h2>

        {notes.length === 0 ? (
          <p className="text-sm text-gray-400 mb-4">Chưa có ghi chú.</p>
        ) : (
          <ul className="space-y-3 mb-4">
            {notes.map((note) => (
              <li key={note.id} className="border-l-2 border-gray-200 pl-3">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.content}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(note.created_at).toLocaleString("vi-VN")}
                </p>
              </li>
            ))}
          </ul>
        )}

        {meeting.status !== "done" && (
          <div className="space-y-2">
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              rows={3}
              placeholder="Thêm ghi chú..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <button
              onClick={handleAddNote}
              disabled={addingNote || !noteInput.trim()}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
            >
              {addingNote ? "Đang thêm..." : "Thêm ghi chú"}
            </button>
          </div>
        )}
      </div>

      {/* Action Items from this meeting */}
      {actionItems.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Action Items</h2>
          <ul className="space-y-2">
            {actionItems.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 px-3 py-2 rounded-lg hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm text-gray-800">{item.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {item.assignee}
                    {item.deadline
                      ? ` · Deadline: ${new Date(item.deadline).toLocaleDateString("vi-VN")}`
                      : ""}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${
                    ACTION_STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {ACTION_STATUS_LABELS[item.status] ?? item.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
