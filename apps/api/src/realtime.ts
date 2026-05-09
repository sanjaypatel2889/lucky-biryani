// Lightweight pub/sub backed by `ws`.
// Topic-based: clients subscribe to e.g. `order:<id>`, `admin:orders`, `rider:<id>`,
// `booking:<id>`, `fleet:live`. Backend `bus.emit(topic, payload)` fans out.
//
// Not BullMQ-grade — but it's the right shape for a single-node demo and
// trivially replaced with Redis pub/sub when scaling out.

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { verifyToken } from './auth';

type Sub = { ws: WebSocket; topics: Set<string> };
const subs = new Set<Sub>();

export const bus = {
  emit(topic: string, payload: any) {
    const msg = JSON.stringify({ topic, payload });
    for (const s of subs) {
      if (s.topics.has(topic) || s.topics.has('*')) {
        if (s.ws.readyState === WebSocket.OPEN) s.ws.send(msg);
      }
    }
  },
};

export function attachWs(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws, req) => {
    const sub: Sub = { ws, topics: new Set() };
    subs.add(sub);

    // optional auth via ?token=
    const u = new URL(req.url ?? '', 'http://x');
    const t = u.searchParams.get('token');
    let principal = t ? verifyToken(t) : null;

    ws.on('message', (raw) => {
      try {
        const m = JSON.parse(raw.toString());
        if (m.action === 'subscribe' && typeof m.topic === 'string') {
          // auth-gate sensitive topics
          if (m.topic.startsWith('admin:') && principal?.role !== 'ADMIN' && principal?.role !== 'OWNER') return;
          if (m.topic.startsWith('rider:') && principal?.role !== 'RIDER' && principal?.role !== 'ADMIN') return;
          sub.topics.add(m.topic);
          ws.send(JSON.stringify({ type: 'subscribed', topic: m.topic }));
        } else if (m.action === 'unsubscribe') {
          sub.topics.delete(m.topic);
        }
      } catch {
        /* ignore */
      }
    });

    ws.on('close', () => subs.delete(sub));
    ws.send(JSON.stringify({ type: 'hello' }));
  });
}
