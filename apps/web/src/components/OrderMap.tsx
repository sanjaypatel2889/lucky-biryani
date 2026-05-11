'use client';

// Google Maps live tracking — loads the Maps JS API on demand. Gracefully
// degrades to a coordinate readout when no key is configured.

import { useEffect, useRef, useState } from 'react';

type Props = {
  branch: { lat: number; lng: number; name?: string };
  destination?: { lat: number; lng: number };
  rider?: { lat: number; lng: number; name?: string };
};

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

function loadGoogleMaps(): Promise<typeof google> {
  // Singleton loader — re-uses the script tag on subsequent navigations
  const w = window as any;
  if (w.google?.maps) return Promise.resolve(w.google);
  if (w.__lbcMapsPromise) return w.__lbcMapsPromise;
  w.__lbcMapsPromise = new Promise<typeof google>((resolve, reject) => {
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
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
        Live map unavailable — set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable the map view. Coordinates still update via WebSocket below.
      </div>
    );
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
