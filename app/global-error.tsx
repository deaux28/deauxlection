"use client";
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en"><body style={{ fontFamily: "system-ui", padding: 32 }}>
      <h1>Something broke.</h1><p>{error.message}</p><button onClick={reset}>Try again</button>
    </body></html>
  );
}
