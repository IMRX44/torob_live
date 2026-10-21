"use client";
import { useEffect, useRef } from "react";
import maplibregl, { type Map as MlMap, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { cn } from "@/lib/cn";

export interface MapPin {
  id: string;
  lat: number;
  lon: number;
  label: string;
  tone: "open" | "closed" | "unknown" | "brand" | "selected" | "confirmed";
  title?: string;
}

export interface MapCircle {
  id: string;
  lat: number;
  lon: number;
  label: string;
  count: number;
}

/** Raster tiles with Persian labels; swap via NEXT_PUBLIC_TILE_URL (e.g. a Neshan/Map.ir tile server). */
const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_TILE_ATTRIBUTION || "© OpenStreetMap contributors";

function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
}

const TONE: Record<MapPin["tone"], string> = {
  open: "background:var(--bg-elev);color:var(--fg);border-color:var(--ok)",
  closed: "background:var(--bg-sunken);color:var(--fg-subtle);border-color:var(--border-strong)",
  unknown: "background:var(--bg-elev);color:var(--fg-muted);border-color:var(--border-strong)",
  brand: "background:var(--brand);color:#fff;border-color:var(--brand)",
  selected: "background:var(--fg);color:var(--bg);border-color:var(--fg)",
  confirmed: "background:var(--ok);color:#fff;border-color:var(--ok)",
};

/** Interactive map with price pins, hub bubbles and the user's origin. */
export function ShopMap({
  origin,
  pins = [],
  circles = [],
  onPinClick,
  onCircleClick,
  className,
  fitToPins = true,
  focus,
}: {
  origin?: { lat: number; lon: number } | null;
  pins?: MapPin[];
  circles?: MapCircle[];
  onPinClick?: (id: string) => void;
  onCircleClick?: (id: string) => void;
  className?: string;
  fitToPins?: boolean;
  focus?: { lat: number; lon: number; zoom?: number } | null;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const handlers = useRef({ onPinClick, onCircleClick });
  handlers.current = { onPinClick, onCircleClick };

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: {
        version: 8,
        sources: { base: { type: "raster", tiles: [TILE_URL], tileSize: 256, maxzoom: 19, attribution: TILE_ATTRIBUTION } },
        layers: [
          {
            id: "base",
            type: "raster",
            source: "base",
            // Light tiles everywhere; in dark mode dim and desaturate them instead of a second provider.
            paint: isDark() ? { "raster-brightness-max": 0.55, "raster-saturation": -0.6, "raster-contrast": 0.1 } : { "raster-saturation": -0.15 },
          },
        ],
      },
      center: [origin?.lon ?? 51.41, origin?.lat ?? 35.7],
      zoom: 14,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    m.touchZoomRotate.disableRotation();
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = [];

    for (const c of circles) {
      const node = document.createElement("button");
      node.type = "button";
      node.setAttribute("aria-label", c.label);
      const size = Math.round(Math.min(48, 24 + Math.sqrt(c.count) * 2.4));
      node.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;background:var(--brand);border:2px solid #fff;box-shadow:var(--shadow-md);display:grid;place-items:center;font:700 11px var(--font-sans);color:#fff;cursor:pointer`;
      node.textContent = c.count.toLocaleString("fa-IR");
      node.onclick = (e) => {
        e.stopPropagation();
        handlers.current.onCircleClick?.(c.id);
      };
      markers.current.push(new maplibregl.Marker({ element: node }).setLngLat([c.lon, c.lat]).addTo(m));
    }

    for (const p of pins) {
      const node = document.createElement("button");
      node.type = "button";
      node.title = p.title ?? p.label;
      node.style.cssText = `${TONE[p.tone]};border-width:2px;border-style:solid;border-radius:9999px;padding:2px 8px;font:700 11px var(--font-sans);white-space:nowrap;box-shadow:var(--shadow-md);cursor:pointer;direction:rtl;transition:transform .15s`;
      node.textContent = p.label;
      node.onmouseenter = () => (node.style.transform = "scale(1.08)");
      node.onmouseleave = () => (node.style.transform = "");
      node.onclick = (e) => {
        e.stopPropagation();
        handlers.current.onPinClick?.(p.id);
      };
      markers.current.push(new maplibregl.Marker({ element: node, anchor: "bottom" }).setLngLat([p.lon, p.lat]).addTo(m));
    }

    if (origin) {
      const me = document.createElement("div");
      me.setAttribute("aria-label", "مبدأ شما");
      me.style.cssText =
        "width:18px;height:18px;border-radius:9999px;background:var(--info);border:3px solid #fff;box-shadow:0 0 0 6px color-mix(in oklch,var(--info) 25%,transparent)";
      markers.current.push(new maplibregl.Marker({ element: me }).setLngLat([origin.lon, origin.lat]).addTo(m));
    }

    if (fitToPins && (pins.length || circles.length)) {
      const b = new maplibregl.LngLatBounds();
      [...pins, ...circles].slice(0, 40).forEach((p) => b.extend([p.lon, p.lat]));
      if (origin) b.extend([origin.lon, origin.lat]);
      m.fitBounds(b, { padding: 60, maxZoom: 16.5, duration: 600 });
    }
  }, [pins, circles, origin, fitToPins]);

  useEffect(() => {
    if (focus && map.current) map.current.flyTo({ center: [focus.lon, focus.lat], zoom: focus.zoom ?? 17, duration: 700 });
  }, [focus]);

  return <div ref={el} className={cn("h-full w-full overflow-hidden", className)} />;
}
