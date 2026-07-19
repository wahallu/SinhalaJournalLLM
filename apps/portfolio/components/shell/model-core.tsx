"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { useReducedMotion, motion } from "motion/react";
import { useTheme } from "next-themes";
import * as THREE from "three";
import { useShell } from "@/components/shell/shell-context";

// Mirrors the adapter angles in components/home/hero-visual.tsx (the SVG
// precursor to this piece) so the two visuals read as the same diagram.
const ADAPTERS = [
  { id: "grammar", angle: -60 },
  { id: "headline", angle: -20 },
  { id: "style", angle: 20 },
  { id: "summary", angle: 60 },
];

const THEME_COLORS = {
  dark: { core: "#e6b455", node: "#4a3d29", edge: "#e6b455" },
  light: { core: "#c9902f", node: "#efe4d3", edge: "#c9902f" },
};

function nodePosition(angleDeg: number): [number, number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  const radius = 1.7;
  return [Math.sin(rad) * radius, Math.cos(rad) * radius * 0.55 + 0.15, 0];
}

function AdapterNode({
  angle,
  color,
  edgeColor,
}: {
  angle: number;
  color: string;
  edgeColor: string;
}) {
  const position = useMemo(() => nodePosition(angle), [angle]);
  return (
    <group position={position}>
      <Line
        points={[
          [0, 0, 0],
          [-position[0], -position[1], -position[2]],
        ]}
        color={edgeColor}
        transparent
        opacity={0.35}
        lineWidth={1}
      />
      <mesh>
        <icosahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial
          color={color}
          roughness={0.35}
          metalness={0.1}
          emissive={color}
          emissiveIntensity={0.08}
        />
      </mesh>
    </group>
  );
}

function Cluster({ paused }: { paused: boolean }) {
  const { resolvedTheme } = useTheme();
  const colors = resolvedTheme === "light" ? THEME_COLORS.light : THEME_COLORS.dark;
  const group = useRef<THREE.Group>(null);
  const target = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    if (!group.current) return;
    if (paused) return;

    target.current.x = state.pointer.x * 0.35;
    target.current.y = state.pointer.y * 0.2;

    group.current.rotation.y = THREE.MathUtils.damp(
      group.current.rotation.y,
      target.current.x,
      4,
      delta
    );
    group.current.rotation.x = THREE.MathUtils.damp(
      group.current.rotation.x,
      -target.current.y,
      4,
      delta
    );
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.08;
  });

  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial
          color={colors.core}
          roughness={0.3}
          metalness={0.15}
          emissive={colors.core}
          emissiveIntensity={0.12}
        />
      </mesh>
      {ADAPTERS.map((adapter) => (
        <AdapterNode
          key={adapter.id}
          angle={adapter.angle}
          color={colors.node}
          edgeColor={colors.edge}
        />
      ))}
    </group>
  );
}

function Scene({ paused }: { paused: boolean }) {
  const { resolvedTheme } = useTheme();
  const colors = resolvedTheme === "light" ? THEME_COLORS.light : THEME_COLORS.dark;
  return (
    <>
      <ambientLight intensity={0.7} />
      <pointLight position={[3, 3, 4]} intensity={1.1} color={colors.core} />
      <pointLight position={[-3, -2, -3]} intensity={0.4} color={colors.edge} />
      <Cluster paused={paused} />
    </>
  );
}

export function ModelCore({ className }: { className?: string }) {
  const { mascotPose, animationsPaused } = useShell();
  const prefersReducedMotion = useReducedMotion();
  const paused = animationsPaused || Boolean(prefersReducedMotion);

  return (
    <motion.div
      aria-hidden
      className={className}
      animate={{
        x: mascotPose.x,
        y: mascotPose.y,
        scale: mascotPose.scale,
      }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{ pointerEvents: "none" }}
    >
      <div
        style={{ pointerEvents: "auto" }}
        className="size-[300px] sm:size-[380px] lg:size-[440px]"
      >
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 4.2], fov: 40 }}
          frameloop={paused ? "demand" : "always"}
          gl={{ alpha: true, antialias: true }}
        >
          <Scene paused={paused} />
        </Canvas>
      </div>
    </motion.div>
  );
}
