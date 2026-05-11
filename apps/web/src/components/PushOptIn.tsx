'use client';

// Registers the service worker, asks for Notification permission once the user
// has logged in, and posts the PushSubscription to /api/v1/push/subscribe.
// All branches no-op gracefully if push isn't supported or the server has no
// VAPID keys configured.

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-store';

export function PushOptIn() {
  const { user, token } = useAuth();
  const [status, setStatus] = useState<'idle' | 'unsupported' | 'subscribed' | 'denied' | 'available' | 'no_key'>('idle');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) { setStatus('unsupported'); return; }

    // Register the service worker exactly once
    navigator.serviceWorker.register('/sw.js').catch(() => {});

    if (!('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') setStatus('denied');
    else if (Notification.permission === 'granted') setStatus('subscribed');
    else setStatus('available');
  }, []);

  async function enable() {
    if (!user || !token) return;
    try {
      const keyRes = await fetch('/api/v1/push/public-key').then((r) => r.json());
      if (!keyRes.enabled || !keyRes.publicKey) {
        setStatus('no_key');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setStatus('denied'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyRes.publicKey),
      });
      await fetch('/api/v1/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: sub.toJSON().keys,
          ua: navigator.userAgent,
        }),
      });
      setStatus('subscribed');
    } catch (e) {
      console.warn('push subscribe failed', e);
    }
  }

  // Render only a small inline opt-in pill when relevant
  if (!user || status === 'idle' || status === 'unsupported' || status === 'subscribed' || status === 'no_key') {
    return null;
  }
  if (status === 'denied') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Notifications are blocked in your browser. Enable them in site settings to get order updates.
      </div>
    );
  }
  return (
    <button
      onClick={enable}
      className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700 transition hover:bg-brand-100"
    >
      🔔 Enable notifications for live order updates
    </button>
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
