import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { getGlobalDir } from './repo-manager.js';

export type ApiKeyScope = 'read' | 'write' | 'admin';
export type CredentialProvider = 'openai' | 'anthropic' | 'gemini' | 'cursor';
export type GitHubCredentialType = 'user' | 'org' | 'repos';

export interface ApiKeyRecord {
  id: string;
  name: string;
  scopes: ApiKeyScope[];
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export interface ApiKeyResult {
  id: string;
  key: string;
}

const DB_FILENAME = 'credentials.sqlite';
const MASTER_KEY_FILENAME = 'master.key';

const getDbPath = (): string => {
  return path.join(getGlobalDir(), DB_FILENAME);
};

const getMasterKeyPath = (): string => {
  return path.join(getGlobalDir(), MASTER_KEY_FILENAME);
};

const ensureMasterKey = (): Buffer => {
  const keyPath = getMasterKeyPath();
  if (fs.existsSync(keyPath)) {
    const raw = fs.readFileSync(keyPath, 'utf-8').trim();
    return Buffer.from(raw, 'base64');
  }

  fs.mkdirSync(getGlobalDir(), { recursive: true });
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, key.toString('base64'), { mode: 0o600 });
  return key;
};

const getMasterKey = (): Buffer => {
  const override = process.env.GITNEXUS_MASTER_KEY;
  if (override) {
    return Buffer.from(override, 'base64');
  }
  return ensureMasterKey();
};

const encryptSecret = (plaintext: string): string => {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
};

const decryptSecret = (payload: string): string => {
  const key = getMasterKey();
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted payload');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

const openDb = (): Database.Database => {
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
};

const initDb = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      scopes TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS llm_credentials (
      id TEXT PRIMARY KEY,
      provider TEXT UNIQUE NOT NULL,
      encrypted_secret TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS github_credentials (
      id TEXT PRIMARY KEY,
      credential_type TEXT NOT NULL,
      owner TEXT NOT NULL,
      encrypted_token TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(credential_type, owner)
    );
  `);
};

const nowIso = (): string => new Date().toISOString();

export const createApiKey = (name: string, scopes: ApiKeyScope[]): ApiKeyResult => {
  const db = openDb();
  initDb(db);

  const id = uuidv4();
  const secret = crypto.randomBytes(24).toString('hex');
  const key = `gnx_${id}_${secret}`;
  const hash = bcrypt.hashSync(secret, 12);

  const stmt = db.prepare(`
    INSERT INTO api_keys (id, name, key_hash, scopes, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, name, hash, JSON.stringify(scopes), nowIso());
  db.close();

  return { id, key };
};

export const listApiKeys = (): ApiKeyRecord[] => {
  const db = openDb();
  initDb(db);
  const rows = db.prepare(`
    SELECT id, name, scopes, created_at, last_used_at, revoked_at
    FROM api_keys
    ORDER BY created_at DESC
  `).all();
  db.close();

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    scopes: JSON.parse(row.scopes),
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at || undefined,
    revokedAt: row.revoked_at || undefined,
  }));
};

export const revokeApiKey = (id: string): boolean => {
  const db = openDb();
  initDb(db);
  const result = db.prepare(`
    UPDATE api_keys SET revoked_at = ?
    WHERE id = ? AND revoked_at IS NULL
  `).run(nowIso(), id);
  db.close();
  return result.changes > 0;
};

export const verifyApiKey = (token: string): { valid: boolean; scopes: ApiKeyScope[] } => {
  const match = token.match(/^gnx_([a-f0-9-]+)_([a-f0-9]+)$/);
  if (!match) {
    return { valid: false, scopes: [] };
  }

  const [, id, secret] = match;
  const db = openDb();
  initDb(db);
  const row = db.prepare(`
    SELECT key_hash, scopes, revoked_at
    FROM api_keys
    WHERE id = ?
  `).get(id);

  if (!row || row.revoked_at) {
    db.close();
    return { valid: false, scopes: [] };
  }

  const ok = bcrypt.compareSync(secret, row.key_hash);
  if (ok) {
    db.prepare(`UPDATE api_keys SET last_used_at = ? WHERE id = ?`).run(nowIso(), id);
  }
  db.close();
  return { valid: ok, scopes: ok ? JSON.parse(row.scopes) : [] };
};

export const storeLLMCredential = (provider: CredentialProvider, apiKey: string): void => {
  const db = openDb();
  initDb(db);
  const encrypted = encryptSecret(apiKey);
  const existing = db.prepare(`SELECT id FROM llm_credentials WHERE provider = ?`).get(provider);
  if (existing) {
    db.prepare(`
      UPDATE llm_credentials
      SET encrypted_secret = ?, updated_at = ?
      WHERE provider = ?
    `).run(encrypted, nowIso(), provider);
  } else {
    db.prepare(`
      INSERT INTO llm_credentials (id, provider, encrypted_secret, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), provider, encrypted, nowIso(), nowIso());
  }
  db.close();
};

export const listLLMCredentials = (): { provider: CredentialProvider; updatedAt: string }[] => {
  const db = openDb();
  initDb(db);
  const rows = db.prepare(`
    SELECT provider, updated_at
    FROM llm_credentials
    ORDER BY provider
  `).all();
  db.close();

  return rows.map((row) => ({
    provider: row.provider,
    updatedAt: row.updated_at,
  }));
};

export const getLLMCredential = (provider: CredentialProvider): string | null => {
  const db = openDb();
  initDb(db);
  const row = db.prepare(`
    SELECT encrypted_secret
    FROM llm_credentials
    WHERE provider = ?
  `).get(provider);
  db.close();
  if (!row) return null;
  return decryptSecret(row.encrypted_secret);
};

export const storeGitHubCredential = (
  type: GitHubCredentialType,
  owner: string,
  token: string,
): void => {
  const db = openDb();
  initDb(db);
  const encrypted = encryptSecret(token);
  const existing = db.prepare(`
    SELECT id FROM github_credentials WHERE credential_type = ? AND owner = ?
  `).get(type, owner);

  if (existing) {
    db.prepare(`
      UPDATE github_credentials
      SET encrypted_token = ?, updated_at = ?
      WHERE credential_type = ? AND owner = ?
    `).run(encrypted, nowIso(), type, owner);
  } else {
    db.prepare(`
      INSERT INTO github_credentials (id, credential_type, owner, encrypted_token, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), type, owner, encrypted, nowIso(), nowIso());
  }
  db.close();
};

export const listGitHubCredentials = (): { type: GitHubCredentialType; owner: string; updatedAt: string }[] => {
  const db = openDb();
  initDb(db);
  const rows = db.prepare(`
    SELECT credential_type, owner, updated_at
    FROM github_credentials
    ORDER BY credential_type, owner
  `).all();
  db.close();

  return rows.map((row) => ({
    type: row.credential_type,
    owner: row.owner,
    updatedAt: row.updated_at,
  }));
};

export const getGitHubCredential = (type: GitHubCredentialType, owner: string): string | null => {
  const db = openDb();
  initDb(db);
  const row = db.prepare(`
    SELECT encrypted_token
    FROM github_credentials
    WHERE credential_type = ? AND owner = ?
  `).get(type, owner);
  db.close();
  if (!row) return null;
  return decryptSecret(row.encrypted_token);
};

export const getGlobalStorageDir = (): string => {
  return path.join(os.homedir(), '.gitnexus');
};
