"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/icons";
import { useToast } from "@/components/ui";
import { uploadPhoto } from "@/lib/merchant";
import { useMerchant } from "./MerchantData";

/** Opens the file picker (camera on phones) and uploads the chosen photo. */
export function usePhotoUpload() {
  const { user } = useMerchant();
  const toast = useToast();
  const [progress, setProgress] = useState<number | null>(null);

  async function upload(file: File | undefined): Promise<string | null> {
    if (!file) return null;
    setProgress(0);
    try {
      return await uploadPhoto(user.uid, file, setProgress);
    } catch (e) {
      toast(`Upload failed: ${(e as Error).message}`, "error");
      return null;
    } finally {
      setProgress(null);
    }
  }
  return { upload, progress, uploading: progress != null };
}

/** Full-screen photo viewer: arrows to page, click (or double-click) a photo to zoom in on that spot. */
export function PhotoViewer({ photos, start = 0, onClose }: { photos: string[]; start?: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  function go(d: number) {
    setZoom(null);
    setI((v) => (v + d + photos.length) % photos.length);
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex animate-fade-in flex-col bg-black/95 text-white" role="dialog" aria-modal="true" aria-label="Photos">
      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">{i + 1} / {photos.length}</span>
        <span className="hidden text-white/60 sm:block">Click the photo to zoom</span>
        <button onClick={onClose} className="group rounded-full p-2 hover:bg-white/10" aria-label="Close">
          <Icon name="close" className="size-6" strokeWidth={2} />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <img
          key={photos[i]}
          src={photos[i]}
          alt={`Photo ${i + 1}`}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setZoom((z) => (z ? null : { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }));
          }}
          style={zoom ? { transform: "scale(2.5)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          className={`max-h-full max-w-full object-contain transition-transform duration-300 ${zoom ? "cursor-zoom-out" : "cursor-zoom-in"}`}
        />
        {photos.length > 1 && (
          <>
            <button onClick={() => go(-1)} className="absolute left-3 rounded-full bg-white/10 p-3 hover:bg-white/20" aria-label="Previous photo">‹</button>
            <button onClick={() => go(1)} className="absolute right-3 rounded-full bg-white/10 p-3 hover:bg-white/20" aria-label="Next photo">›</button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Up to [max] photo slots: add (upload), view, make one the cover / front
 * photo (moves it first) or remove. [onChange] gets the new list.
 */
export function PhotoSlots({ photos, max, onChange, firstLabel }: { photos: string[]; max: number; onChange: (list: string[]) => void; firstLabel?: string }) {
  const { upload, progress } = usePhotoUpload();
  const input = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [menu, setMenu] = useState<number | null>(null);

  async function add(files: FileList | null) {
    const list = [...photos];
    for (const f of Array.from(files ?? []).slice(0, max - photos.length)) {
      const url = await upload(f);
      if (url) list.push(url);
    }
    if (list.length !== photos.length) onChange(list.slice(0, max));
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {photos.map((u, i) => (
          <div key={u} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-surface">
            <button type="button" className="block size-full" onClick={() => setMenu(menu === i ? null : i)} aria-label={`Photo ${i + 1} options`}>
              <img src={u} alt="" className="size-full object-cover transition group-hover:scale-105" />
            </button>
            {i === 0 && firstLabel && <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-bold text-white">{firstLabel}</span>}
            {menu === i && (
              <div className="absolute inset-0 flex animate-fade-in flex-col items-stretch justify-center gap-1 bg-ink/75 p-1.5 text-xs font-semibold text-white">
                <button type="button" className="rounded-lg bg-white/15 py-1.5 hover:bg-white/25" onClick={() => { setViewing(i); setMenu(null); }}>View</button>
                {i > 0 && firstLabel && (
                  <button type="button" className="rounded-lg bg-white/15 py-1.5 hover:bg-white/25" onClick={() => { onChange([u, ...photos.filter((_, j) => j !== i)]); setMenu(null); }}>Make {firstLabel.toLowerCase()}</button>
                )}
                <button type="button" className="rounded-lg bg-red-600/80 py-1.5 hover:bg-red-600" onClick={() => { onChange(photos.filter((_, j) => j !== i)); setMenu(null); }}>Remove</button>
              </div>
            )}
          </div>
        ))}
        {photos.length < max && (
          <button
            type="button"
            disabled={progress != null}
            onClick={() => input.current?.click()}
            className="group flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brand/30 bg-brand-50/40 text-xs font-semibold text-brand transition hover:bg-brand-50 disabled:cursor-wait"
          >
            {progress != null ? (
              <>
                <span className="text-sm">{Math.round(progress * 100)}%</span>
                <span className="h-1 w-3/4 overflow-hidden rounded-full bg-white"><span className="block h-full bg-brand transition-all" style={{ width: `${progress * 100}%` }} /></span>
              </>
            ) : (
              <>
                <Icon name="camera" className="size-6" />
                Add photo
              </>
            )}
          </button>
        )}
      </div>
      <p className="mt-1.5 text-xs text-ink-3">{photos.length} of {max} photos{photos.length > 1 && firstLabel ? " · click one to view, reorder or remove" : ""}</p>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      {viewing != null && <PhotoViewer photos={photos} start={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
