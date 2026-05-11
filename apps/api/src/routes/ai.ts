// AI-related endpoints. POST /chat accepts a short history; the system prompt
// is built server-side so the menu can't be poisoned by the client.

import { Router } from 'express';
import { z } from 'zod';
import { chat } from '../services/luckyAi';
import { config } from '../config';

export const aiRouter = Router();

aiRouter.get('/status', (_req, res) => {
  res.json({
    enabled: config.ai.enabled,
    mode: config.ai.enabled ? 'live' : 'fallback',
    model: config.ai.enabled ? config.ai.model : 'rule-based',
  });
});

aiRouter.post('/chat', async (req, res) => {
  const body = z.object({
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1).max(2000),
    })).min(1).max(20),
    mode: z.enum(['text', 'voice']).optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_body' });

  try {
    const result = await chat(body.data.messages, body.data.mode ?? 'text');
    res.json(result);
  } catch (e: any) {
    console.error('[ai/chat]', e?.message);
    res.status(503).json({ error: 'ai_unavailable', detail: e?.message });
  }
});
