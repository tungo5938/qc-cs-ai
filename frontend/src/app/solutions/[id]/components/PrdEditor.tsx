// @ts-nocheck
"use client";
import { useEffect, useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useWorkspace } from "./WorkspaceContext";
import { api } from "@/lib/api";

interface PrdEditorProps {
  solutionId: string;
  initialContent: object | null;
}

export function PrdEditor({ solutionId, initialContent }: PrdEditorProps) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { prdHighlight } = useWorkspace();

  const editor = useEditor({
    extensions: [StarterKit],
    immediatelyRender: false,
    content: (initialContent as any) || "<p>Bắt đầu viết PRD...</p>",
    onUpdate: ({ editor }) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        const json = editor.getJSON();
        await api.solutions.patchPrd(solutionId, json).catch(console.error);
      }, 2000);
    },
  });

  const applyPatch = useCallback(
    (newContent: string) => {
      if (!editor) return;
      const current = editor.getHTML();
      editor.commands.setContent(current + `\n<p>${newContent}</p>`);
    },
    [editor]
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__prdApplyPatch = applyPatch;
    }
  }, [applyPatch]);

  useEffect(() => {
    if (!prdHighlight) return;
    const el = document.querySelector(`[data-anchor-id="${prdHighlight}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-blue-100", "transition-colors");
      setTimeout(() => el.classList.remove("bg-blue-100"), 2000);
    }
  }, [prdHighlight]);

  function copyAsHtml() {
    if (!editor) return;
    navigator.clipboard.writeText(editor.getHTML());
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-2 bg-blue-50 border-b border-blue-100">
        <span className="text-xs font-semibold text-blue-700 mr-2">📄 PRD</span>
        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`px-2 py-0.5 text-xs border rounded font-bold ${editor?.isActive("bold") ? "bg-blue-200" : "bg-white"}`}
        >
          B
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`px-2 py-0.5 text-xs border rounded italic ${editor?.isActive("italic") ? "bg-blue-200" : "bg-white"}`}
        >
          I
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-2 py-0.5 text-xs border rounded ${editor?.isActive("heading", { level: 1 }) ? "bg-blue-200" : "bg-white"}`}
        >
          H1
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-0.5 text-xs border rounded ${editor?.isActive("heading", { level: 2 }) ? "bg-blue-200" : "bg-white"}`}
        >
          H2
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={`px-2 py-0.5 text-xs border rounded ${editor?.isActive("bulletList") ? "bg-blue-200" : "bg-white"}`}
        >
          • List
        </button>
        <div className="flex-1" />
        <button
          onClick={copyAsHtml}
          className="px-2 py-0.5 text-xs border rounded bg-white text-gray-600 hover:bg-gray-50"
        >
          📋 Copy
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <EditorContent editor={editor} className="prose prose-sm max-w-none min-h-full" />
      </div>
    </div>
  );
}
