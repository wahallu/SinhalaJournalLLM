import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config/site";

export const alt = `${siteConfig.name}: ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "96px",
          backgroundColor: "#171412",
          color: "#fafaf9",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              backgroundColor: "#e0a12e",
              display: "flex",
            }}
          />
          {siteConfig.name}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 64,
            fontWeight: 600,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            maxWidth: 900,
          }}
        >
          {siteConfig.tagline}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 32,
            fontSize: 28,
            color: "#a8a29e",
          }}
        >
          A university research project built on SinLlama
        </div>
      </div>
    ),
    { ...size }
  );
}
