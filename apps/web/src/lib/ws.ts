'use client';

// Tiny WebSocket helper that auto-reconnects and lets components subscribe to topics.

import { useEffect, useRef } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

type Handler = (msg: any) => void;

let socket: WebSocket | null = null;
const listeners = new Map<string, Set<Handler>>();
let reconnectTimer: any = null;

function connect() {
  const tok = typeof window !== 'undefined' ? localStorage.getItem('lbc_token') : null;
  socket = new WebSocket(`${WS_URL}/ws${tok ? `?token=${encodeURIComponent(tok)}` : ''}`);
  socket.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data);
      if (!m.topic) return;
      listeners.get(m.topic)?.forEach((h) => h(m.payload));
    } catch { /* ignore */ }
  };
  socket.onclose = () => {
    socket = null;
    if (!reconnectTimer) reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, 2000);
  };
  socket.onopen = () => {
    // re-subscribe to known topics
    for (const t of listeners.keys()) {
      socket?.send(JSON.stringify({ action: 'subscribe', topic: t }));
    }
  };
}

export function useWsTopic(topic: string | null, handler: Handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    if (!topic) return;
    if (!socket) connect();
    const wrapped = (m: any) => handlerRef.current(m);
    if (!listeners.has(topic)) listeners.set(topic, new Set());
    listeners.get(topic)!.add(wrapped);
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action: 'subscribe', topic }));
    }
    return () => {
      listeners.get(topic)!.delete(wrapped);
      if (listeners.get(topic)!.size === 0) {
        listeners.delete(topic);
        socket?.send?.(JSON.stringify({ action: 'unsubscribe', topic }));
      }
    };
  }, [topic]);
}
