"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reads the recipient's QR voucher with the computer's or phone's camera.
 * Calls [onCode] once per code seen (the same code is ignored for 2 s).
 * Cameras only work on https:// pages (and on localhost).
 */
export function QrScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const last = useRef<{ code: string; at: number } | null>(null);
  const handler = useRef(onCode);
  handler.current = onCode;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser cannot use the camera here. Open the page over https, or type the code instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (e) {
        const name = (e as DOMException).name;
        setError(name === "NotAllowedError" ? "Camera permission is off. Allow it in the browser, or type the code instead." : "No camera is available. Type the code instead.");
        return;
      }
      if (stopped || !video.current) return stream.getTracks().forEach((t) => t.stop());
      const v = video.current;
      v.srcObject = stream;
      await v.play().catch(() => {});
      setReady(true);
      const { default: jsQR } = await import("jsqr");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      timer = setInterval(() => {
        if (!ctx || v.readyState < 2 || !v.videoWidth) return;
        // Decode a smaller copy: much faster and still reads phone screens fine.
        const scale = Math.min(1, 640 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const found = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" });
        const code = found?.data?.trim();
        if (!code) return;
        const now = Date.now();
        if (last.current && last.current.code === code && now - last.current.at < 2000) return;
        last.current = { code, at: now };
        navigator.vibrate?.(60);
        handler.current(code);
      }, 220);
    })();
    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink">
      <video ref={video} muted playsInline className="aspect-[4/3] w-full object-cover" />
      {!error && (
        <div className="pointer-events-none absolute inset-10 rounded-2xl border-4 border-white/70">
          <span className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-brand" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8 text-sm text-white">
        <span>{error ? "" : ready ? "Point the camera at the recipient's QR voucher" : "Starting the camera…"}</span>
        <button onClick={onClose} className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 font-semibold hover:bg-white/25">Stop camera</button>
      </div>
      {error && <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-white/80">{error}</div>}
    </div>
  );
}
