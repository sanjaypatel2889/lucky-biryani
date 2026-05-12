'use client';

// In-app chat between customer and rider, scoped to one order. Real-time via
// the existing order:<id> WebSocket topic, persistent via /api/v1/orders/:id/chat.

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useWsTopic } from '@/lib/ws';

type Message = {
  id: string;
  fromRole: string;
  body: string;
  createdAt: string;
};

const TEMPLATES = [
  "I'm at the gate",
  "Please leave it at the door",
  "Call me when you arrive",
  "Apartment 304, 3rd floor",
];

export function RiderChat({ orderId, myRole }: { orderId: string; myRole: 'CUSTOMER' | 'RIDER' }) {
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const r = await api<{ messages: Message[] }>(`/api/v1/orders/${orderId}/chat`);
      setMsgs(r.messages);
    } catch { /* ignore */ }
  }
  useEffect(() => { void load(); }, [orderId]);

  useWsTopic(`order:${orderId}`, (msg) => {
    if (msg?.type === 'chat' && msg.message) {
      setMsgs((cur) => cur.find((m) => m.id === msg.message.id) ? cur : [...cur, msg.message]);
    }
  });

  useEffect(() => {
    if (open) requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 1e6, behavior: 'smooth' }));
  }, [msgs.length, open]);

  async function send(body: string) {
    const trimmed = body.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await api(`/api/v1/orders/${orderId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ body: trimmed }),
      });
      setText('');
      // Optimistic add not required — WS will push it back
    } catch { /* ignore */ }
    setBusy(false);
  }

  const unread = msgs.filter((m) => m.fromRole !== myRole).length;
  const otherLabel = myRole === 'CUSTOMER' ? 'rider' : 'customer';

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-stone-50"
      >
        <div>
          <div className="text-sm font-medium text-stone-800">💬 Chat with your {otherLabel}</div>
          <div className="text-xs text-stone-500">
            {msgs.length === 0 ? 'No messages yet — say hi 👋' : `${msgs.length} message${msgs.length === 1 ? '' : 's'}`}
            {unread > 0 && <span className="ml-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread} new</span>}
          </div>
        </div>
        <span className="text-stone-400">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="border-t border-stone-100">
          <div ref={scrollRef} className="max-h-72 space-y-2 overflow-y-auto bg-stone-50 p-3">
            {msgs.length === 0 && (
              <p className="text-center text-xs text-stone-400">Pick a quick reply below or type your own.</p>
            )}
            {msgs.map((m) => {
              const mine = m.fromRole === myRole;
              return (
                <div key={m.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={mine
                    ? 'max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-600 px-3 py-1.5 text-sm text-white'
                    : 'max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-3 py-1.5 text-sm text-stone-800 shadow-sm ring-1 ring-stone-100'}>
                    {m.body}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1.5 border-t border-stone-100 bg-white p-2">
            {TEMPLATES.map((t) => (
              <button
                key={t}
                onClick={() => send(t)}
                className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] text-stone-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >{t}</button>
            ))}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); void send(text); }}
            className="flex gap-2 border-t border-stone-100 bg-white p-2"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 rounded-full border border-stone-200 px-3 py-1.5 text-sm outline-none focus:border-brand-400"
              disabled={busy}
              maxLength={500}
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="rounded-full bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white disabled:bg-stone-300"
            >Send</button>
          </form>
        </div>
      )}
    </div>
  );
}
