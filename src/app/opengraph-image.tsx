import { ImageResponse } from "next/og";

export const alt = "Local Shelf: browse Brighton & Hove Libraries' films, books and audiobooks";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default social card (title pages use their cover instead). */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "linear-gradient(135deg, #0b1a33 0%, #0057b8 100%)",
        color: "#f7f2e8",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <svg width="96" height="96" viewBox="0 0 64 64">
          <rect width="64" height="64" rx="14" fill="#0057b8" />
          <rect x="14" y="16" width="9" height="34" rx="2" fill="#f7f2e8" />
          <rect x="26" y="12" width="9" height="38" rx="2" fill="#f7f2e8" />
          <rect x="38" y="20" width="9" height="30" rx="2" transform="rotate(-12 42 35)" fill="#e0573a" />
        </svg>
        <div style={{ fontSize: 64, fontWeight: 700 }}>Local Shelf</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1 }}>
          Brighton &amp; Hove Libraries, browsed better
        </div>
        <div style={{ fontSize: 32, opacity: 0.85 }}>
          Films, TV, books and audiobooks. See what&apos;s on the shelf near you.
        </div>
      </div>
    </div>,
    size,
  );
}
