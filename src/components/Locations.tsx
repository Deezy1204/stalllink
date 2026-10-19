"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef, type ReactNode } from "react";

import { Icon } from "@/components/icons";
import type { ShopDoc } from "@/lib/types";

/** A place a shop's orders can be collected from: its main shop or one of its branches. */
export interface Place {
  id: string;
  name: string;
  main: boolean;
  standNo: string;
  address: string;
  suburb: string;
  city: string;
  phone: string;
  hours: string;
  lat: number | null;
  lng: number | null;
}

/** The main shop first, then every branch (branches without their own phone or hours use the shop's). */
export function shopPlaces(s: ShopDoc): Place[] {
  const main: Place = {
    id: "main",
    name: "Main shop",
    main: true,
    standNo: s.standNo ?? "",
    address: s.address ?? "",
    suburb: s.suburb ?? "",
    city: s.city ?? "",
    phone: s.phone ?? "",
    hours: s.hours ?? "",
    lat: s.lat ?? null,
    lng: s.lng ?? null,
  };
  return [
    main,
    ...(s.branches ?? []).map((b) => ({
      id: b.id,
      name: b.name || "Branch",
      main: false,
      standNo: b.standNo ?? "",
      address: b.address ?? "",
      suburb: b.suburb ?? "",
      city: b.city || s.city || "",
      phone: b.phone || s.phone || "",
      hours: b.hours || s.hours || "",
      lat: b.lat ?? null,
      lng: b.lng ?? null,
    })),
  ];
}

const pinned = (p: Place) => p.lat != null && p.lng != null;

/** Google Maps directions to the exact pin, or a search for the address when there is none. */
export function directionsUrl(p: Place, shopName: string) {
  if (pinned(p)) return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  const q = [shopName, p.standNo, p.address, p.suburb, p.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Map of every pinned place, numbered as in the list. OpenStreetMap, so no API key is needed. */
export function LocationsMap({ places, className = "h-64" }: { places: Place[]; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const key = places.map((p) => `${p.id}:${p.lat},${p.lng}`).join("|");

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | undefined;
    (async () => {
      const mod = await import("leaflet");
      const L = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
      if (cancelled || !el.current) return;
      const points = places.map((p, i) => ({ p, i })).filter(({ p }) => pinned(p));
      if (!points.length) return;
      map = L.map(el.current, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
      for (const { p, i } of points) {
        const icon = L.divIcon({
          className: "",
          html: `<span class="loc-pin ${p.main ? "loc-pin-main" : ""}" style="animation-delay:${i * 90}ms"><b>${i + 1}</b></span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
        });
        L.marker([p.lat!, p.lng!], { icon, title: p.name }).addTo(map).bindTooltip(p.name, { direction: "top", offset: [0, -28] });
      }
      const bounds = L.latLngBounds(points.map(({ p }) => [p.lat!, p.lng!] as [number, number]));
      if (points.length === 1) map.setView(bounds.getCenter(), 16);
      else map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
      // A modal or card may still be sizing itself.
      setTimeout(() => map?.invalidateSize(), 300);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
    // Redraw only when the places themselves change.
  }, [key]);

  if (!places.some(pinned)) return null;
  return <div ref={el} className={`relative z-0 overflow-hidden rounded-2xl border border-line ${className}`} />;
}

/** Every place with its address, hours and phone, and links to call or get directions. */
export function LocationList({
  places,
  shopName,
  columns = 2,
  note,
}: {
  places: Place[];
  shopName: string;
  columns?: 1 | 2;
  /** Extra line per place, e.g. how many orders wait there. */
  note?: (p: Place) => ReactNode;
}) {
  return (
    <ol className={`grid gap-2 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
      {places.map((p, i) => (
        <li key={p.id} className="group flex gap-3 rounded-2xl border border-line bg-white p-3">
          <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${p.main ? "bg-brand text-white" : "bg-brand-50 text-brand"}`}>{i + 1}</span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="flex items-center gap-1.5 font-bold text-ink">
              <span className="truncate">{p.name}</span>
              {p.main && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase text-brand">Main</span>}
            </p>
            {(p.standNo || p.address) && <p className="text-ink-2">{[p.standNo, p.address].filter(Boolean).join(" • ")}</p>}
            {(p.suburb || p.city) && <p className="text-ink-3">{[p.suburb, p.city].filter(Boolean).join(", ")}</p>}
            {p.hours && <p className="mt-0.5 text-xs text-ink-3">{p.hours}</p>}
            {note?.(p)}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
              <a href={directionsUrl(p, shopName)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
                <Icon name="pin" className="size-3.5" strokeWidth={2} /> Directions
              </a>
              {p.phone && (
                <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="text-brand hover:underline">
                  Call {p.phone}
                </a>
              )}
              {!pinned(p) && <span className="text-amber-700">Not pinned on the map yet</span>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
