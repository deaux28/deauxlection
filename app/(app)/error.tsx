"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <section className="wrap big-empty">
      <div className="eyebrow mono">Something went wrong</div>
      <h1 style={{ fontSize: "clamp(36px,6vw,64px)" }}>The collection didn&apos;t load.</h1>
      <p>{error.message}</p>
      <div className="acts"><button className="btn ink" onClick={reset}>Try again</button></div>
    </section>
  );
}
