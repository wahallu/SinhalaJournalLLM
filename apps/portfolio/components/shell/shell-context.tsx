"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type MascotPose = {
  /** Horizontal offset in pixels from the wrapper's default anchor. */
  x: number;
  /** Vertical offset in pixels from the wrapper's default anchor. */
  y: number;
  scale: number;
};

export const DEFAULT_MASCOT_POSE: MascotPose = { x: 0, y: 0, scale: 1 };

type ShellContextValue = {
  animationsPaused: boolean;
  toggleAnimationsPaused: () => void;
  mascotPose: MascotPose;
  setMascotPose: (pose: MascotPose) => void;
  assistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;
  briefOpen: boolean;
  setBriefOpen: (open: boolean) => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [animationsPaused, setAnimationsPaused] = useState(false);
  const [mascotPose, setMascotPose] = useState<MascotPose>(DEFAULT_MASCOT_POSE);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);

  const toggleAnimationsPaused = useCallback(() => setAnimationsPaused((p) => !p), []);

  const value = useMemo<ShellContextValue>(
    () => ({
      animationsPaused,
      toggleAnimationsPaused,
      mascotPose,
      setMascotPose,
      assistantOpen,
      setAssistantOpen,
      briefOpen,
      setBriefOpen,
    }),
    [animationsPaused, toggleAnimationsPaused, mascotPose, assistantOpen, briefOpen]
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used within ShellProvider");
  return ctx;
}

/** Pages call this to reposition the persistent 3D mascot for their layout. */
export function usePageMascotPose(pose: MascotPose) {
  const { setMascotPose } = useShell();
  useEffect(() => {
    setMascotPose(pose);
    return () => setMascotPose(DEFAULT_MASCOT_POSE);
    // Depend on primitives, not the `pose` object reference, so callers can
    // pass an inline literal without retriggering this every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose.x, pose.y, pose.scale, setMascotPose]);
}
