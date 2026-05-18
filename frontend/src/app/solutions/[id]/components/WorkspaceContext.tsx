// @ts-nocheck
"use client";
import { createContext, useContext, useState, useCallback } from "react";

interface WorkspaceContextValue {
  activeAnchor: string | null;
  setActiveAnchor: (anchorId: string | null) => void;
  highlightFromCanvas: (anchorId: string) => void;
  highlightFromPrd: (anchorId: string) => void;
  canvasHighlight: string | null;
  prdHighlight: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  activeAnchor: null,
  setActiveAnchor: () => {},
  highlightFromCanvas: () => {},
  highlightFromPrd: () => {},
  canvasHighlight: null,
  prdHighlight: null,
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [canvasHighlight, setCanvasHighlight] = useState<string | null>(null);
  const [prdHighlight, setPrdHighlight] = useState<string | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);

  const highlightFromCanvas = useCallback((anchorId: string) => {
    setPrdHighlight(anchorId);
    setActiveAnchor(anchorId);
    setTimeout(() => setPrdHighlight(null), 2000);
  }, []);

  const highlightFromPrd = useCallback((anchorId: string) => {
    setCanvasHighlight(anchorId);
    setActiveAnchor(anchorId);
    setTimeout(() => setCanvasHighlight(null), 2000);
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{ activeAnchor, setActiveAnchor, highlightFromCanvas, highlightFromPrd, canvasHighlight, prdHighlight }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
