import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from 'http';

import { config } from './config';
import { authOptional } from './auth';
import { attachWs } from './realtime';
import { startWorkers } from './workers';

import { authRouter } from './routes/auth';
import { menuRouter } from './routes/menu';
import { orderRouter } from './routes/orders';
import { bookingRouter } from './routes/bookings';
import { riderRouter } from './routes/rider';
import { adminRouter } from './routes/admin';
import { webhookRouter } from './routes/webhooks';

const app = express();

app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(authOptional);

app.get('/api/v1/health', (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/menu', menuRouter);
app.use('/api/v1/orders', orderRouter);
app.use('/api/v1/bookings', bookingRouter);
app.use('/api/v1/rider', riderRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/webhooks', webhookRouter);

// Generic error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api] unhandled', err);
  res.status(500).json({ error: 'internal_error', detail: err?.message });
});

const server = http.createServer(app);
attachWs(server);
startWorkers();

server.listen(config.port, () => {
  console.log(`\n🍛 Lucky Biryani API listening on http://localhost:${config.port}`);
  console.log(`   WebSocket: ws://localhost:${config.port}/ws`);
  console.log(`   Frontend:  ${config.frontendUrl}\n`);
});
