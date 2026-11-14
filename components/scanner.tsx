"use client";
import { useEffect, useRef, useState } from "react";

/** Live camera barcode reader. Uses ZXing so it works on iPhone Safari as well as Chrome. */
export function Scanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [msg, setMsg] = useState("Starting the camera…");
  const done = useRef(false);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.UPC_A, BarcodeFormat.EAN_8, BarcodeFormat.UPC_E]);
        const reader = new BrowserMultiFormatReader(hints);
        if (cancelled || !video.current) return;
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } } },
          video.current,
          (result) => {
            if (result && !done.current) {
              done.current = true;
              navigator.vibrate?.(40);
              controls.stop();
              onCode(result.getText());
            }
          },
        );
        stop = () => controls.stop();
        setMsg("Point at the barcode on the back of the sleeve or book.");
      } catch (e) {
        const name = (e as Error).name;
        setMsg(name === "NotAllowedError" ? "Camera access was blocked. Allow it in your browser settings, or type the number below."
          : name === "NotFoundError" ? "No camera found. Type the number below instead."
          : "The camera couldn't start. Type the number below instead.");
      }
    })();
    return () => { cancelled = true; stop?.(); };
  }, [onCode]);

  return (
    <div className="scanner">
      <video ref={video} playsInline muted />
      <div className="reticle" />
      <div className="msg">{msg}</div>
      <button type="button" className="icon-btn" onClick={onClose} aria-label="Stop scanning" style={{ position: "absolute", top: 8, right: 8, color: "#fff", background: "rgba(0,0,0,.4)" }}>✕</button>
    </div>
  );
}
