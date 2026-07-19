"use client";

import { usePageMascotPose } from "@/components/shell/shell-context";

// Shrinks + moves the persistent ModelCore out of the reading column on
// content-heavy pages, so it reads as a small persistent decoration rather
// than an obstruction. Renders nothing itself.
const TUCKED_POSE = { x: 0, y: -320, scale: 0.32 };

export function TuckMascot() {
  usePageMascotPose(TUCKED_POSE);
  return null;
}
