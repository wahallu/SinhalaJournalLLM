"use client";

import { motion, useReducedMotion } from "motion/react";

const adapters = [
  { id: "grammar", label: "Grammar", angle: -60 },
  { id: "headline", label: "Headline", angle: -20 },
  { id: "style", label: "Style", angle: 20 },
  { id: "summary", label: "Summary", angle: 60 },
];

const CENTER = { x: 140, y: 230 };
const RADIUS = 108;

function nodePosition(angleDeg: number) {
  const angle = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER.x + RADIUS * Math.sin(angle),
    y: CENTER.y - RADIUS * Math.cos(angle) - 30,
  };
}

export function HeroVisual() {
  const reduce = useReducedMotion();

  return (
    <svg
      viewBox="0 0 280 420"
      className="h-auto w-full max-w-md"
      role="img"
      aria-label="SinLlama base model branching into four task-specific adapters: grammar, headline, style, and summary"
    >
      {adapters.map((adapter, i) => {
        const pos = nodePosition(adapter.angle);
        return (
          <motion.line
            key={`line-${adapter.id}`}
            x1={CENTER.x}
            y1={CENTER.y}
            x2={pos.x}
            y2={pos.y}
            stroke="var(--color-primary)"
            strokeOpacity={0.35}
            strokeWidth={1.5}
            strokeDasharray="4 5"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.15 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="motion-safe:[animation:dash_18s_linear_infinite]"
          />
        );
      })}

      <motion.circle
        cx={CENTER.x}
        cy={CENTER.y}
        r={34}
        fill="var(--color-card)"
        stroke="var(--color-primary)"
        strokeWidth={1.5}
        initial={reduce ? false : { scale: 0, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      />
      <text
        x={CENTER.x}
        y={CENTER.y + 5}
        textAnchor="middle"
        className="fill-foreground text-[11px] font-medium"
      >
        SinLlama
      </text>

      {adapters.map((adapter, i) => {
        const pos = nodePosition(adapter.angle);
        return (
          <motion.g
            key={adapter.id}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          >
            <circle
              cx={pos.x}
              cy={pos.y}
              r={26}
              fill="var(--color-accent)"
              stroke="var(--color-primary)"
              strokeWidth={1}
            />
            <text
              x={pos.x}
              y={pos.y + 4}
              textAnchor="middle"
              className="fill-accent-foreground text-[9px] font-medium"
            >
              {adapter.label}
            </text>
          </motion.g>
        );
      })}

      <style>{`
        @keyframes dash {
          to { stroke-dashoffset: -180; }
        }
      `}</style>
    </svg>
  );
}
