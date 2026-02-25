import { createApiKey, listApiKeys } from '../storage/api-keys.js';

const parseScopes = (input?: string): string[] => {
  if (!input) return ['read'];
  return input.split(',').map((s) => s.trim()).filter(Boolean);
};

export const keysCreateCommand = async (opts: { name?: string; scopes?: string }) => {
  const name = (opts.name || '').trim();
  if (!name) {
    console.log('Missing --name for API key.');
    return;
  }

  const scopes = parseScopes(opts.scopes);
  const validScopes = scopes.filter((scope) => ['read', 'write', 'admin'].includes(scope));
  const result = createApiKey(name, validScopes.length ? validScopes : ['read']);

  console.log(`API key created (${result.id}). Store this securely:`);
  console.log(result.key);
};

export const keysListCommand = async () => {
  const keys = listApiKeys();
  if (keys.length === 0) {
    console.log('No API keys found.');
    return;
  }

  console.log(`\n  API Keys (${keys.length})\n`);
  for (const key of keys) {
    const masked = `${key.id.slice(0, 6)}…${key.id.slice(-4)}`;
    console.log(`  ${key.name}`);
    console.log(`    ID: ${masked}`);
    console.log(`    Scopes: ${key.scopes.join(', ')}`);
    console.log(`    Created: ${new Date(key.createdAt).toLocaleString()}`);
    if (key.lastUsedAt) console.log(`    Last used: ${new Date(key.lastUsedAt).toLocaleString()}`);
    if (key.revokedAt) console.log(`    Revoked: ${new Date(key.revokedAt).toLocaleString()}`);
    console.log('');
  }
};
