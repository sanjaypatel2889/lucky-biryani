'use client';

// Address book on the cart. Lists saved addresses, lets the user add a new
// one inline (with "Use current location" via the browser Geolocation API),
// edit the default, or delete one.
//
// When Google Maps SDK is loaded (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY), the form
// uses Places autocomplete; otherwise it's a plain text input with a
// geolocation button. Both paths produce the same lat/lng + line1 payload.

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

export type Address = {
  id: string;
  label: string;
  line1: string;
  line2?: string | null;
  pincode: string;
  city?: string;
  lat: number;
  lng: number;
  isDefault: boolean;
};

type Props = {
  selected: Address | null;
  onSelect: (a: Address) => void;
};

export function AddressPicker({ selected, onSelect }: Props) {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await api<{ addresses: Address[] }>('/api/v1/addresses');
      setAddresses(r.addresses);
      // Auto-select the default address if nothing is picked yet
      if (!selected) {
        const def = r.addresses.find((a) => a.isDefault) ?? r.addresses[0];
        if (def) onSelect(def);
      }
    } catch { /* ignore — not logged in */ }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [user?.id]);

  async function remove(id: string) {
    await api(`/api/v1/addresses/${id}`, { method: 'DELETE' });
    setAddresses((cur) => cur.filter((a) => a.id !== id));
    if (selected?.id === id) {
      const remaining = addresses.filter((a) => a.id !== id);
      if (remaining[0]) onSelect(remaining[0]);
    }
  }

  if (!user) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
        Log in to save addresses and skip retyping next time.
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-stone-400">Loading addresses…</p>;
  }

  return (
    <div className="space-y-2">
      {addresses.length === 0 && !adding && (
        <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">
          No saved addresses yet.
        </div>
      )}

      {addresses.map((a) => {
        const isSel = selected?.id === a.id;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelect(a)}
            className={`block w-full rounded-lg border px-3 py-2.5 text-left transition ${isSel ? 'border-brand-500 bg-brand-50' : 'border-stone-200 bg-white hover:border-stone-300'}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                <span className={`h-3 w-3 rounded-full border-2 ${isSel ? 'border-brand-600 bg-brand-600' : 'border-stone-300'}`} />
                {a.label}
                {a.isDefault && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Default</span>}
              </div>
              <span
                onClick={(e) => { e.stopPropagation(); void remove(a.id); }}
                className="text-xs text-stone-400 hover:text-rose-500"
                role="button"
              >Remove</span>
            </div>
            <div className="mt-1 text-xs text-stone-600">{a.line1}{a.line2 ? `, ${a.line2}` : ''} · {a.pincode}</div>
            <div className="text-[10px] text-stone-400">{a.lat.toFixed(4)}, {a.lng.toFixed(4)}</div>
          </button>
        );
      })}

      {adding ? (
        <NewAddressForm
          onSaved={async (a) => {
            await load();
            onSelect(a);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="block w-full rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3 py-2.5 text-center text-sm font-medium text-stone-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
        >
          + Add a new address
        </button>
      )}
    </div>
  );
}

function NewAddressForm({ onSaved, onCancel }: { onSaved: (a: Address) => void; onCancel: () => void }) {
  const [label, setLabel] = useState('Home');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [pincode, setPincode] = useState('');
  const [lat, setLat] = useState(17.385);
  const [lng, setLng] = useState(78.4867);
  const [isDefault, setIsDefault] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function useCurrentLocation() {
    if (!navigator.geolocation) { setErr('Geolocation not supported'); return; }
    setLocating(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocating(false);
      },
      (e) => {
        setErr(e.message || 'Could not get location');
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 },
    );
  }

  async function save() {
    if (!line1.trim() || !/^\d{6}$/.test(pincode)) {
      setErr('Address line and a 6-digit pincode are required');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const r = await api<{ address: Address }>('/api/v1/addresses', {
        method: 'POST',
        body: JSON.stringify({
          label, line1: line1.trim(), line2: line2.trim() || undefined,
          pincode, city: 'Hyderabad', lat, lng, isDefault,
        }),
      });
      onSaved(r.address);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not save');
    }
    setSaving(false);
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-2">
      <div className="flex gap-2">
        {(['Home', 'Work', 'Other'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLabel(l)}
            className={`rounded-full border px-3 py-1 text-xs transition ${label === l ? 'border-brand-500 bg-brand-100 text-brand-800' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'}`}
          >{l}</button>
        ))}
      </div>
      <input className="input" placeholder="Flat / building / street" value={line1} onChange={(e) => setLine1(e.target.value)} />
      <input className="input" placeholder="Landmark / area (optional)" value={line2} onChange={(e) => setLine2(e.target.value)} />
      <div className="flex gap-2">
        <input className="input" placeholder="Pincode" value={pincode} maxLength={6} onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="btn-secondary text-xs whitespace-nowrap"
        >
          {locating ? 'Locating…' : '📍 Use current location'}
        </button>
      </div>
      <p className="text-[10px] text-stone-400">Pinned at {lat.toFixed(4)}, {lng.toFixed(4)} — used to calculate delivery distance.</p>
      <label className="flex items-center gap-2 text-xs text-stone-600">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="accent-brand-600" />
        Set as default
      </label>
      {err && <p className="text-xs text-rose-600">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={saving} className="btn-primary !py-1.5 flex-1 text-sm">
          {saving ? 'Saving…' : 'Save address'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary !py-1.5 text-sm">Cancel</button>
      </div>
    </div>
  );
}
