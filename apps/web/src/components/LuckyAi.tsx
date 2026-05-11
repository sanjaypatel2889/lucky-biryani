'use client';

// Floating chat widget — "Lucky AI". Calls /api/v1/ai/chat which uses Claude
// Haiku on the server (or a rule-based fallback when no key is configured).

import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

const STORAGE_KEY = 'lbc_lucky_ai';
const GREETING: Msg = {
  role: 'assistant',
  content: "Hey! I'm Lucky — I can recommend dishes, help you book a table, or answer menu questions. What are you craving?",
};

export function LuckyAi() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'live' | 'fallback' | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Restore conversation from session storage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setMsgs(parsed);
      }
    } catch {}
    fetch('/api/v1/ai/status')
      .then((r) => r.json())
      .then((j) => setMode(j.mode))
      .catch(() => {});
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs)); } catch {}
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, [msgs]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: text }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    try {
      const r = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.filter((m) => m !== GREETING).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'chat_failed');
      setMode(j.mode);
      setMsgs((m) => [...m, { role: 'assistant', content: j.reply }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: 'assistant', content: "Sorry, I tripped on a spice. Try asking again?" }]);
    }
    setBusy(false);
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-xl shadow-brand-700/30 ring-2 ring-white/60 transition hover:scale-105 active:scale-95"
        aria-label="Open Lucky AI"
      >
        {open ? <Close /> : <ChatGlyph />}
        <span className="pointer-events-none absolute inset-0 -z-10 animate-pulse rounded-full bg-brand-500/30" />
      </button>

      {/* Drawer */}
      {open && (
        <div className="fixed bottom-24 right-5 z-40 flex h-[min(72vh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
          <div className="bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-4 py-3 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20 font-display text-lg font-bold">L</div>
                <div className="leading-tight">
                  <div className="text-[11px] uppercase tracking-[0.18em] opacity-80">Lucky AI</div>
                  <div className="text-sm font-semibold">Your food concierge</div>
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider opacity-80">
                {mode === 'live' ? 'online' : mode === 'fallback' ? 'lite mode' : '…'}
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-stone-50 p-4">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={
                  m.role === 'user'
                    ? 'max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-600 px-3 py-2 text-sm text-white'
                    : 'max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-slate-800 shadow-sm ring-1 ring-slate-100'
                }>
                  {m.content.split('\n').map((line, j) => (
                    <span key={j} className="block">{line}</span>
                  ))}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">
                  Lucky is thinking…
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-white p-2">
            <div className="mb-2 flex flex-wrap gap-1.5 px-1">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  onClick={() => { setInput(p); }}
                >
                  {p}
                </button>
              ))}
            </div>
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); send(); }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything…"
                disabled={busy}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const QUICK_PROMPTS = [
  "What's good today?",
  "I'm vegetarian",
  "Spicy and under ₹300",
  "Book a table for 4",
  "Coupons?",
];

function ChatGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
function Close() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
