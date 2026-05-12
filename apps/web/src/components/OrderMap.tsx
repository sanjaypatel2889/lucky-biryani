'use client';

// Google Maps live tracking — loads the Maps JS API on demand. Gracefully
// degrades to a coordinate readout when no key is configured.
//
// Note: we cast through `any` rather than importing @types/google.maps so the
// Vercel build doesn't require an extra dep just to enable this optional
// feature. The Maps SDK is loaded at runtime only when the key is set.

import { useEffect, useRef, useState } from 'react';

type Props = {
  branch: { lat: number; lng: number; name?: string };
  destination?: { lat: number; lng: number };
  rider?: { lat: number; lng: number; name?: string };
};

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

function loadGoogleMaps(): Promise<any> {
  // Singleton loader — re-uses the script tag on subsequent navigations
  const w = window as any;
  if (w.google?.maps) return Promise.resolve(w.google);
  if (w.__lbcMapsPromise) return w.__lbcMapsPromise;
  w.__lbcMapsPromise = new Promise<any>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&v=weekly`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(w.google);
    s.onerror = () => reject(new Error('maps_load_failed'));
    document.head.appendChild(s);
  });
  return w.__lbcMapsPromise;
}

export function OrderMap({ branch, destination, rider }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!MAPS_KEY) { setErr('no_key'); return; }
    let cancelled = false;
    loadGoogleMaps().then((g) => {
      if (cancelled || !ref.current) return;
      const center = rider ?? destination ?? branch;
      mapRef.current = new g.maps.Map(ref.current, {
        center, zoom: 14, disableDefaultUI: true, zoomControl: true,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      });
      markersRef.current.branch = new g.maps.Marker({
        position: branch, map: mapRef.current, title: branch.name ?? 'Restaurant',
        label: { text: '🍛', fontSize: '18px' },
      });
      if (destination) {
        markersRef.current.dest = new g.maps.Marker({
          position: destination, map: mapRef.current, title: 'Delivery',
          label: { text: '🏠', fontSize: '18px' },
        });
      }
    }).catch(() => setErr('maps_load_failed'));
    return () => { cancelled = true; };
  }, []);

  // Update rider marker when geo changes
  useEffect(() => {
    if (!mapRef.current || !rider) return;
    const g = (window as any).google;
    if (!g) return;
    if (markersRef.current.rider) {
      markersRef.current.rider.setPosition(rider);
    } else {
      markersRef.current.rider = new g.maps.Marker({
        position: rider, map: mapRef.current,
        label: { text: '🛵', fontSize: '20px' },
        title: rider.name ?? 'Rider',
      });
    }
    mapRef.current.panTo(rider);
  }, [rider?.lat, rider?.lng]);

  if (err === 'no_key') {
    return <SvgRouteFallback branch={branch} destination={destination} rider={rider} />;
  }
  if (err === 'maps_load_failed') {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
        Couldn't load Google Maps. Check the API key and billing.
      </div>
    );
  }
  return <div ref={ref} className="h-72 w-full overflow-hidden rounded-xl border border-stone-200" />;
}

// SVG fallback when there's no Google Maps key. Projects branch / destination /
// rider into a 320×200 viewBox, then draws an animated dashed path between
// them. Updates rider position smoothly via CSS transitions.
function SvgRouteFallback({ branch, destination, rider }: Props) {
  if (!destination) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
        Live map unavailable — coordinates update via WebSocket below.
      </div>
    );
  }

  // Build a bounding box around all 3 points, then normalize each to a 320x180
  // canvas with a 30px padding margin.
  const pts = [branch, destination, ...(rider ? [rider] : [])];
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const pad = 30;
  const W = 320, H = 180;
  function project(p: { lat: number; lng: number }) {
    const x = maxLng === minLng ? W / 2 : pad + ((p.lng - minLng) / (maxLng - minLng)) * (W - 2 * pad);
    // Note: SVG Y is inverted vs lat
    const y = maxLat === minLat ? H / 2 : pad + ((maxLat - p.lat) / (maxLat - minLat)) * (H - 2 * pad);
    return { x, y };
  }
  const b = project(branch);
  const d = project(destination);
  const r = rider ? project(rider) : null;

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-gradient-to-br from-stone-50 to-stone-100 p-3">
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-stone-500">
        <span>Live route</span>
        <span className="text-stone-400">Map view: set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full">
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        {/* Route line — animated draw-in */}
        <path
          d={`M ${b.x} ${b.y} Q ${(b.x + d.x) / 2 + 20} ${(b.y + d.y) / 2 - 40} ${d.x} ${d.y}`}
          stroke="#ea580c" strokeWidth="3" strokeLinecap="round" fill="none"
          strokeDasharray="6 6"
          className="route-draw"
        />
        {/* Branch marker */}
        <g transform={`translate(${b.x}, ${b.y})`}>
          <circle r="10" fill="#fff" stroke="#ea580c" strokeWidth="2" />
          <text textAnchor="middle" dy="4" fontSize="11">🍛</text>
        </g>
        {/* Destination marker */}
        <g transform={`translate(${d.x}, ${d.y})`}>
          <circle r="10" fill="#fff" stroke="#16a34a" strokeWidth="2" />
          <text textAnchor="middle" dy="4" fontSize="11">🏠</text>
        </g>
        {/* Rider marker — smooth transition between positions */}
        {r && (
          <g style={{ transition: 'transform 1s cubic-bezier(0.22, 1, 0.36, 1)' }} transform={`translate(${r.x}, ${r.y})`}>
            <circle r="13" fill="#ea580c" opacity="0.2" className="animate-breathe" />
            <circle r="8" fill="#ea580c" />
            <text textAnchor="middle" dy="4" fontSize="11">🛵</text>
          </g>
        )}
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-600" /> Lucky Biryani</span>
        {rider && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-600 animate-breathe" /> Rider en route</span>}
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-600" /> You</span>
      </div>
    </div>
  );
}
