import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from './config';
import { prisma } from './db';

export type Principal = { id: string; role: string; phone: string };

export function signToken(p: Principal): string {
  return jwt.sign(p, config.jwtSecret, { expiresIn: '30d' });
}

export function verifyToken(token: string): Principal | null {
  try {
    return jwt.verify(token, config.jwtSecret) as Principal;
  } catch {
    return null;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: Principal;
  }
}

export function authOptional(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  const tok = h?.startsWith('Bearer ') ? h.slice(7) : (req.cookies?.token as string | undefined);
  if (tok) {
    const p = verifyToken(tok);
    if (p) req.user = p;
  }
  next();
}

export function requireAuth(roles: string[] = []) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'auth_required' });
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    // ensure user still exists & not flagged
    const u = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!u) return res.status(401).json({ error: 'user_missing' });
    next();
  };
}
