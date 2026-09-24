"use client";

// Last resort for errors in the root layout itself — it replaces the whole document, so it can't
// rely on the app's layout, theme provider, or stylesheet; kept self-contained with inline styles.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0b",
          color: "#f4f4f5",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Adit couldn&apos;t load</h1>
          <p style={{ color: "#9a9aa2", fontSize: 14, margin: "0 0 20px" }}>
            Something went wrong on our side.{error.digest ? ` Reference: ${error.digest}.` : ""} Please try again.
          </p>
          <button
            onClick={() => retry()}
            style={{ background: "#fff", color: "#0a0a0b", border: 0, borderRadius: 999, padding: "8px 20px", fontSize: 14, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
