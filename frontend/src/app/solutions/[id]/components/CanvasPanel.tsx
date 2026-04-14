"use client";
import { useEffect, useRef, useCallback } from "react";
import { Tldraw } from "@tldraw/tldraw";
import type { Editor, TLShape } from "@tldraw/tldraw";
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

      editor.store.listen(() => {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(async () => {
          const snapshot = editor.getSnapshot();
          await api.solutions.patchCanvas(solutionId, snapshot).catch(console.error);
        }, 2000);
      });

      editor.on("click", (info: any) => {
        const shape: TLShape | undefined = info.shape;
        if (shape?.meta?.anchorId) {
          highlightFromCanvas(shape.meta.anchorId as string);
        }
      });
    },
    [solutionId, initialData, highlightFromCanvas]
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
