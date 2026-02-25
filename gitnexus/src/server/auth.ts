import { NextFunction, Request, Response } from 'express';
import { ApiKeyScope, listApiKeys, verifyApiKey } from '../storage/api-keys.js';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 300;
const rateState = new Map<string, { windowStart: number; count: number }>();

const hasScope = (granted: ApiKeyScope[], required: ApiKeyScope[]): boolean => {
  if (required.length === 0) return true;
  if (granted.includes('admin')) return true;
  return required.every((scope) => granted.includes(scope));
};

const checkRateLimit = (key: string): boolean => {
  const now = Date.now();
  const current = rateState.get(key);
  if (!current || now - current.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateState.set(key, { windowStart: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= RATE_LIMIT_MAX;
};

const extractToken = (req: Request): string | null => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
};

export const requireApiKey = (opts?: { scopes?: ApiKeyScope[]; allowIfNoKeys?: boolean }) => {
  const scopes = opts?.scopes || [];
  const allowIfNoKeys = opts?.allowIfNoKeys ?? false;

  return (req: Request, res: Response, next: NextFunction) => {
    if (allowIfNoKeys && listApiKeys().length === 0) {
      return next();
    }

    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Missing API key' });
    }

    const { valid, scopes: granted } = verifyApiKey(token);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (!hasScope(granted, scopes)) {
      return res.status(403).json({ error: 'Insufficient scope' });
    }

    const rateKey = token.slice(0, 32);
    if (!checkRateLimit(rateKey)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    (req as any).apiScopes = granted;
    return next();
  };
};
