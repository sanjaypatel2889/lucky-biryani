'use client';

// Floating chat widget — "Lucky AI". Two modes:
//   - text  : send via /api/v1/ai/chat, render assistant replies in the drawer
//   - voice : click the mic, browser SpeechRecognition transcribes you, the
//             reply comes back voice-tuned (short, spelled-out prices, no
//             emojis), and we speak it through SpeechSynthesis.
//
// All speech APIs are browser-native — no extra keys, no extra cost.

import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };
type Mode = 'text' | 'voice';

const STORAGE_KEY = 'lbc_lucky_ai';
const GREETING: Msg = {
  role: 'assistant',
  content: "Hey! I'm Lucky — I can recommend dishes, help you book a table, or answer menu questions. What are you craving?",
};
const VOICE_GREETING = "Hey there. I'm Lucky. Tap the mic and tell me what you're in the mood for.";

export function LuckyAi() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'live' | 'fallback' | null>(null);
  const [convMode, setConvMode] = useState<Mode>('text');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const recogRef = useRef<any>(null);

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

    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (SR && 'speechSynthesis' in window) setVoiceSupported(true);
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs)); } catch {}
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, [msgs]);

  // Cancel any in-flight speech when the drawer closes
  useEffect(() => {
    if (!open) {
      try { window.speechSynthesis?.cancel(); } catch {}
      stopListening();
      setSpeaking(false);
    }
  }, [open]);

  async function send(textOverride?: string, asVoice = false) {
    const text = (textOverride ?? input).trim();
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
          mode: asVoice ? 'voice' : 'text',
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'chat_failed');
      setMode(j.mode);
      setMsgs((m) => [...m, { role: 'assistant', content: j.reply }]);
      if (asVoice) speak(j.reply);
    } catch (e: any) {
      const fallback = "Sorry, I tripped on a spice. Try asking again?";
      setMsgs((m) => [...m, { role: 'assistant', content: fallback }]);
      if (asVoice) speak(fallback);
    }
    setBusy(false);
  }

  function speak(text: string) {
    if (!('speechSynthesis' in window)) return;
    try { window.speechSynthesis.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance(text);
    // Pick a clear English voice — prefer Indian-English when available.
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /en-IN/i.test(v.lang)) ||
      voices.find((v) => /en-GB/i.test(v.lang)) ||
      voices.find((v) => /en-US/i.test(v.lang)) ||
      voices.find((v) => v.lang.startsWith('en'));
    if (preferred) u.voice = preferred;
    u.rate = 1.02;
    u.pitch = 1.0;
    u.volume = 1.0;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }

  function stopListening() {
    try { recogRef.current?.stop?.(); } catch {}
    recogRef.current = null;
    setListening(false);
  }

  function startListening() {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    try { window.speechSynthesis?.cancel(); } catch {}
    const recog = new SR();
    recog.lang = 'en-IN';
    recog.interimResults = false;
    recog.continuous = false;
    recog.maxAlternatives = 1;
    recog.onstart = () => setListening(true);
    recog.onerror = () => { setListening(false); recogRef.current = null; };
    recog.onend = () => { setListening(false); recogRef.current = null; };
    recog.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript ?? '';
      if (text.trim()) {
        setConvMode('voice');
        send(text, true);
      }
    };
    recogRef.current = recog;
    try {
      recog.start();
    } catch {
      setListening(false);
      recogRef.current = null;
    }
  }

  function micClick() {
    if (listening) {
      stopListening();
      return;
    }
    // First voice press: replace canned greeting with the voice greeting so
    // the spoken context is right.
    if (convMode !== 'voice') {
      setConvMode('voice');
      setMsgs((m) => (m.length === 1 && m[0] === GREETING) ? [{ role: 'assistant', content: VOICE_GREETING }] : m);
      speak(VOICE_GREETING);
    }
    // Give the speak() call a beat to start before we open the mic.
    setTimeout(() => startListening(), 300);
  }

  function stopSpeaking() {
    try { window.speechSynthesis?.cancel(); } catch {}
    setSpeaking(false);
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
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider opacity-90">
                {speaking && <span className="rounded-full bg-white/20 px-2 py-0.5">🔊 speaking</span>}
                <span>{mode === 'live' ? 'online' : mode === 'fallback' ? 'lite mode' : '…'}</span>
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
                  {listening ? 'Listening…' : 'Lucky is thinking…'}
                </div>
              </div>
            )}
            {listening && (
              <div className="flex justify-end">
                <div className="rounded-2xl rounded-tr-sm bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
                  🎤 Listening… speak now
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
              onSubmit={(e) => { e.preventDefault(); setConvMode('text'); send(); }}
            >
              {voiceSupported && (
                <button
                  type="button"
                  onClick={micClick}
                  disabled={busy && !listening}
                  title={listening ? 'Stop listening' : 'Talk to Lucky'}
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${
                    listening
                      ? 'bg-rose-500 text-white shadow ring-2 ring-rose-200 animate-pulse'
                      : 'bg-slate-100 text-slate-600 hover:bg-brand-100 hover:text-brand-700'
                  }`}
                  aria-label={listening ? 'Stop listening' : 'Talk to Lucky'}
                >
                  <MicGlyph />
                </button>
              )}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={listening ? 'Listening…' : (voiceSupported ? 'Type or tap the mic…' : 'Ask me anything…')}
                disabled={busy || listening}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
              {speaking ? (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="rounded-full bg-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
                  title="Stop speaking"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={busy || listening || !input.trim()}
                  className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Send
                </button>
              )}
            </form>
            {!voiceSupported && (
              <p className="mt-1.5 px-2 text-[10px] text-slate-400">
                Voice not supported in this browser. Try Chrome, Edge or Safari for mic input.
              </p>
            )}
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
function MicGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
