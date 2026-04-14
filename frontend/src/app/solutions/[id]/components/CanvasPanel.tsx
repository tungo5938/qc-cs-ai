"use client";
import { useEffect, useRef, useCallback } from "react";
import { Tldraw } from "@tldraw/tldraw";
import type { Editor } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import { useWorkspace } from "./WorkspaceContext";
import { api } from "@/lib/api";

interface CanvasPanelProps {
  solutionId: string;
  initialData: object | null;
}

export function CanvasPanel({ solutionId, initialData }: CanvasPanelProps) {
  const editorRef = useRef<Editor | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { highlightFromCanvas, canvasHighlight } = useWorkspace();
  const highlightFromCanvasRef = useRef(highlightFromCanvas);
  highlightFromCanvasRef.current = highlightFromCanvas;

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;

      if (initialData && Object.keys(initialData).length > 0) {
        try {
          editor.loadSnapshot(initialData as any);
        } catch (e) {
          console.warn("[Canvas] Failed to load snapshot:", e);
        }
      }

      // Auto-save on any store change (debounce 2s)
      editor.store.listen(() => {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(async () => {
          const snapshot = editor.getSnapshot();
          await api.solutions.patchCanvas(solutionId, snapshot).catch(console.error);
        }, 2000);
      });

      // Detect shape clicks with anchor_id via selection change
      editor.on("change", () => {
        const selected = editor.getSelectedShapes();
        if (selected.length === 1 && selected[0].meta?.anchorId) {
          highlightFromCanvasRef.current(selected[0].meta.anchorId as string);
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [solutionId, initialData]
  );

  useEffect(() => {
    if (!canvasHighlight || !editorRef.current) return;
    const editor = editorRef.current;
    const shapes = editor.getCurrentPageShapes();
    const target = shapes.find((s) => s.meta?.anchorId === canvasHighlight);
    if (target) {
      editor.select(target.id);
      editor.zoomToSelection();
    }
  }, [canvasHighlight]);

  return (
    <div className="w-full h-full" style={{ position: "relative" }}>
      <Tldraw onMount={handleMount} />
    </div>
  );
}
