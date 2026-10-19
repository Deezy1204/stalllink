"use client";

import "leaflet/dist/leaflet.css";

import type { Map as LeafletMap } from "leaflet";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Icon } from "@/components/icons";
import { Button, Modal, useToast } from "@/components/ui";
import { cityCentre } from "@/lib/catalog";

type LatLng = { lat: number; lng: number };

/**
 * Map for pinning the exact entrance customers should walk to. The pin stays
 * in the middle; the merchant moves the map underneath it (as in the app).
 * OpenStreetMap tiles and search, so no API key is needed.
 */
export function MapPicker({
  open,
  onClose,
  onPick,
  city,
  initial,
  searchHint = "",
  title = "Pin your location",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (p: LatLng) => void;
  city: string;
  initial?: LatLng | null;
  searchHint?: string;
  title?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const toast = useToast();
  const [q, setQ] = useState(searchHint);
  const [busy, setBusy] = useState(false);
  /** The pin lifts while the map moves under it, and drops when it stops. */
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (open) setQ(searchHint);
  }, [open, searchHint]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const mod = await import("leaflet");
      const L = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
      if (cancelled || !el.current) return;
      const [lat, lng] = initial ? [initial.lat, initial.lng] : cityCentre(city);
      const m = L.map(el.current).setView([lat, lng], initial ? 17 : 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(m);
      m.on("click", (e) => m.panTo(e.latlng));
      m.on("movestart", () => setMoving(true));
      m.on("moveend", () => setMoving(false));
      map.current = m;
      // The modal animates in; measure again once it has its final size.
      setTimeout(() => m.invalidateSize(), 300);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // Only when it opens: later prop changes must not reset where the merchant moved the map.
  }, [open]);

  async function find(e: FormEvent) {
    e.preventDefault();
    const text = q.trim();
    if (!text || !map.current) return;
    setBusy(true);
    try {
      const where = text.toLowerCase().includes(city.toLowerCase()) ? text : `${text}, ${city}`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=zw&q=${encodeURIComponent(where)}`, { headers: { "Accept-Language": "en" } });
      const hits = (await res.json()) as { lat: string; lon: string }[];
      if (!hits.length) toast("Could not find that place. Move the map to your spot instead.", "error");
      else map.current.setView([Number(hits[0].lat), Number(hits[0].lon)], 17);
    } catch {
      toast("Search is not available right now. Move the map to your spot instead.", "error");
    } finally {
      setBusy(false);
    }
  }

  function here() {
    if (!navigator.geolocation) return toast("This browser cannot share your location.", "error");
    navigator.geolocation.getCurrentPosition(
      (p) => map.current?.setView([p.coords.latitude, p.coords.longitude], 18),
      () => toast("Location is off or was refused. Search or move the map instead.", "error"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              const c = map.current?.getCenter();
              if (c) onPick({ lat: Number(c.lat.toFixed(6)), lng: Number(c.lng.toFixed(6)) });
            }}
          >
            Confirm this location
          </Button>
        </>
      }
    >
      <form onSubmit={find} className="mb-3 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a place or street"
          className="h-10 min-w-0 flex-1 rounded-xl border border-line px-3 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
        />
        <Button type="submit" variant="secondary" loading={busy}>Search</Button>
        <Button type="button" variant="ghost" className="group" onClick={here} title="Use my current location" aria-label="Use my current location">
          <Icon name="pin" />
        </Button>
      </form>
      <div className="relative h-[min(52vh,420px)] overflow-hidden rounded-2xl border border-line">
        <div ref={el} className="absolute inset-0" />
        {/* Shadow on the exact spot, and the pin above it. */}
        <span className={`pointer-events-none absolute left-1/2 top-1/2 z-[500] h-1.5 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/30 blur-[1px] transition-all duration-200 ${moving ? "scale-150 opacity-40" : ""}`} />
        <span className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full">
          <svg
            className={`map-pin size-11 text-brand drop-shadow-lg transition-transform duration-200 ${moving ? "-translate-y-2.5 scale-105" : ""}`}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5" />
          </svg>
        </span>
      </div>
      <p className="mt-2 text-center text-xs text-ink-3">Move the map so the pin sits on the entrance customers should walk to.</p>
    </Modal>
  );
}

/** The form row showing whether a pin is set; opens the map. */
export function PinTile({ lat, lng, onPick, error }: { lat?: number | null; lng?: number | null; onPick: () => void; error?: boolean }) {
  const set = lat != null && lng != null;
  return (
    <button
      type="button"
      onClick={onPick}
      className={`group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:shadow-sm ${set ? "border-mint-600/40 bg-mint-100" : error ? "border-red-400 bg-red-50" : "border-brand/30 bg-brand-50/50"}`}
    >
      <span className={`flex size-10 items-center justify-center rounded-xl bg-white ${set ? "text-mint-800" : "text-brand"}`}>
        <Icon name="pin" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{set ? "Location pinned" : "Pin exact location on map"}</span>
        <span className={`block text-xs ${error && !set ? "text-red-700" : "text-ink-3"}`}>
          {set ? `${lat!.toFixed(5)}, ${lng!.toFixed(5)} · click to change` : "Customers get directions to this spot"}
        </span>
      </span>
      <span className="text-ink-3">›</span>
    </button>
  );
}
