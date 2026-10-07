"use client";

import StackSpread, { type StackSpreadCard } from "@/components/ui/stack-spread";

const IMG = "/assets/aiexpo/web";

/**
 * CodeBlast Hackathon Challenge 2026 (SLTMOBITEL, AI Hackathon of Sri Lanka
 * AI Week 2026, National AI Expo), 25 September 2026, SLT Auditorium. The
 * team reached the top 10 in the University AI Innovation category and
 * received certificates for it. Photos: public/assets/aiexpo (originals),
 * resized into ./web without changing orientation.
 *
 * Card sizes follow each photo's shape (w in vw, h in vh, tuned at 16:9).
 * Array order = stack order, back to front.
 */
const CARDS: StackSpreadCard[] = [
  {
    item: { src: `${IMG}/pitch-1.jpg`, alt: "Presenting SinAi on stage at the AI Hackathon" },
    stackOffset: { x: -8, y: -10 },
    stackRotate: -18,
    target: { x: -31, y: -30, rotate: 0, w: 18, h: 17 },
    targetSm: { x: -22, y: -40 },
    z: 2,
  },
  {
    item: { src: `${IMG}/judges.jpg`, alt: "The team presenting to the judging panel" },
    stackOffset: { x: 14, y: -10 },
    stackRotate: 20,
    target: { x: 1, y: -33, rotate: 0, w: 18, h: 17 },
    targetSm: { x: 22, y: -40 },
    z: 3,
  },
  {
    item: { src: `${IMG}/team.jpg`, alt: "The team in front of the CodeBlast Hackathon Challenge 2026 backdrop" },
    stackOffset: { x: -16, y: 0 },
    stackRotate: -4,
    target: { x: -38, y: 2, rotate: 0, w: 10, h: 30 },
    targetSm: { x: -22, y: -19 },
    z: 4,
  },
  {
    item: { src: `${IMG}/award.jpg`, alt: "Receiving certificates on stage at CodeBlast 2026" },
    stackOffset: { x: 1, y: -10 },
    stackRotate: -2,
    target: { x: 31, y: -30, rotate: 0, w: 16, h: 23 },
    targetSm: { x: 22, y: -19 },
    z: 5,
  },
  {
    item: { src: `${IMG}/pitch-2.jpg`, alt: "Explaining the SinAi system during the pitch" },
    stackOffset: { x: 18, y: 1 },
    stackRotate: 6,
    target: { x: -24, y: 33, rotate: 0, w: 18, h: 17 },
    targetSm: { x: -22, y: 20 },
    z: 6,
  },
  {
    item: { src: `${IMG}/pitch-3.jpg`, alt: "The team on stage during the AI Hackathon" },
    stackOffset: { x: -6, y: 10 },
    stackRotate: 6,
    target: { x: 28, y: 33, rotate: 0, w: 18, h: 17 },
    targetSm: { x: 22, y: 20 },
    z: 7,
  },
  {
    item: { src: `${IMG}/handshake.jpg`, alt: "Talking with a judge after the presentation" },
    stackOffset: { x: 8, y: 7 },
    stackRotate: 3,
    target: { x: 2, y: 35, rotate: 0, w: 18, h: 17 },
    targetSm: { x: -22, y: 40 },
    z: 8,
  },
  {
    item: { src: `${IMG}/certificate.jpg`, alt: "Certificate, University AI Innovation category, AI Hackathon of Sri Lanka AI Week 2026" },
    stackOffset: { x: 20, y: 12 },
    stackRotate: -7,
    target: { x: 37, y: 3, rotate: 0, w: 14, h: 32 },
    targetSm: { x: 22, y: 40 },
    z: 9,
  },
];

export default function AiExpo() {
  return (
    <StackSpread
      id="recognition"
      cards={CARDS}
      bgColor="#F0EFEB"
      textColor="#181818"
      showScrollHint={false}
      title={
        <>
          Top 10 <span className="text-crimson">finalists</span>
        </>
      }
      subtitle="CodeBlast Hackathon Challenge 2026 · National AI Expo, Sri Lanka AI Week. University AI Innovation category, 25 September 2026."
    />
  );
}
