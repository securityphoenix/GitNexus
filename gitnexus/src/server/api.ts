/**
 * HTTP API Server (Multi-Repo)
 *
 * REST API for browser-based clients to query indexed repositories.
 * Uses LocalBackend for multi-repo support via the global registry —
 * the same backend the MCP server uses.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { LocalBackend } from '../mcp/local/local-backend.js';
import { NODE_TABLES } from '../core/kuzu/schema.js';
import { GraphNode, GraphRelationship } from '../core/graph/types.js';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  storeLLMCredential,
  listLLMCredentials,
  storeGitHubCredential,
  listGitHubCredentials,
} from '../storage/api-keys.js';
import { enqueueGitHubScan, listGitHubJobs } from '../services/github.js';
import {
  extractAndStoreContributors,
  listContributorsByRepo,
  listContributorFiles,
  listFileContributors,
} from '../services/contributors.js';
import { getSimilarContributors, getSimilarRepos } from '../services/similarity.js';
import { requireApiKey } from './auth.js';

/**
 * Build the full knowledge graph for a repo by querying each node table
 * and all relationships via the backend's cypher tool.
 */
const buildGraph = async (
  backend: LocalBackend,
  repoName: string,
): Promise<{ nodes: GraphNode[]; relationships: GraphRelationship[] }> => {
  const nodes: GraphNode[] = [];

  for (const table of NODE_TABLES) {
    try {
      let query = '';
      if (table === 'File') {
        query = `MATCH (n:File) RETURN n.id AS id, n.name AS name, n.filePath AS filePath, n.content AS content`;
      } else if (table === 'Folder') {
        query = `MATCH (n:Folder) RETURN n.id AS id, n.name AS name, n.filePath AS filePath`;
      } else if (table === 'Contributor') {
        query = `MATCH (n:Contributor) RETURN n.id AS id, n.name AS name, n.email AS email, n.githubUsername AS githubUsername, n.avatarUrl AS avatarUrl`;
      } else if (table === 'FileContribution') {
        query = `MATCH (n:FileContribution) RETURN n.id AS id, n.repoName AS repoName, n.filePath AS filePath, n.commits AS commits, n.linesAdded AS linesAdded, n.linesDeleted AS linesDeleted`;
      } else if (table === 'Community') {
        query = `MATCH (n:Community) RETURN n.id AS id, n.label AS label, n.heuristicLabel AS heuristicLabel, n.cohesion AS cohesion, n.symbolCount AS symbolCount`;
      } else if (table === 'Process') {
        query = `MATCH (n:Process) RETURN n.id AS id, n.label AS label, n.heuristicLabel AS heuristicLabel, n.processType AS processType, n.stepCount AS stepCount, n.communities AS communities, n.entryPointId AS entryPointId, n.terminalId AS terminalId`;
      } else {
        query = `MATCH (n:${table}) RETURN n.id AS id, n.name AS name, n.filePath AS filePath, n.startLine AS startLine, n.endLine AS endLine, n.content AS content`;
      }

      const result = await backend.executeCypher(repoName, query);
      // cypher returns the rows directly (array), or { error } on failure
      const rows = Array.isArray(result) ? result : [];

      for (const row of rows) {
        nodes.push({
          id: row.id ?? row[0],
          label: table as GraphNode['label'],
          properties: {
            name: row.name ?? row.label ?? row.filePath ?? row[1] ?? '',
            filePath: row.filePath ?? '',
            startLine: row.startLine,
            endLine: row.endLine,
            content: row.content,
            email: row.email,
            githubUsername: row.githubUsername,
            avatarUrl: row.avatarUrl,
            repoName: row.repoName,
            commits: row.commits,
            linesAdded: row.linesAdded,
            linesDeleted: row.linesDeleted,
            heuristicLabel: row.heuristicLabel,
            cohesion: row.cohesion,
            symbolCount: row.symbolCount,
            processType: row.processType,
            stepCount: row.stepCount,
            communities: row.communities,
            entryPointId: row.entryPointId,
            terminalId: row.terminalId,
          } as GraphNode['properties'],
        });
      }
    } catch {
      // ignore empty tables
    }
  }

  const relationships: GraphRelationship[] = [];
  try {
    const relResult = await backend.executeCypher(
      repoName,
      `MATCH (a)-[r:CodeRelation]->(b) RETURN a.id AS sourceId, b.id AS targetId, r.type AS type, r.confidence AS confidence, r.reason AS reason, r.step AS step`,
    );
    const relRows = Array.isArray(relResult) ? relResult : [];

    for (const row of relRows) {
      relationships.push({
        id: `${row.sourceId}_${row.type}_${row.targetId}`,
        type: row.type,
        sourceId: row.sourceId,
        targetId: row.targetId,
        confidence: row.confidence,
        reason: row.reason,
        step: row.step,
      });
    }
  } catch (err: any) {
    console.warn('GitNexus: relationship query failed:', err?.message);
  }

  return { nodes, relationships };
};

const httpStatus = (err: any): number => {
  const msg = err?.message ?? '';
  if (msg.includes('not found') || msg.includes('No indexed')) return 404;
  if (msg.includes('Multiple repositories')) return 400;
  return 500;
};

export const createServer = async (port: number) => {
  const backend = new LocalBackend();
  const hasRepos = await backend.init();

  if (!hasRepos) {
    console.warn('GitNexus: No indexed repositories found. The server will start but most endpoints will return errors.');
    console.warn('Run "gitnexus analyze" in a repository to index it first.');
  }

  const app = express();
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server), localhost, and the deployed site.
      // The server binds to 127.0.0.1 so only the local machine can reach it — CORS just gates
      // which browser-tab origins may issue the request.
      if (
        !origin
        || origin.startsWith('http://localhost:')
        || origin.startsWith('http://127.0.0.1:')
        || origin === 'https://gitnexus.vercel.app'
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  }));
  app.use(express.json({ limit: '10mb' }));

  // ─── GET /api/repos ─────────────────────────────────────────────
  // List all indexed repositories
  app.get('/api/repos', async (_req, res) => {
    try {
      const repos = await backend.listRepos();
      res.json(repos);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to list repos' });
    }
  });

  // ─── GET /api/repo?repo=X ──────────────────────────────────────
  // Get metadata for a specific repo
  app.get('/api/repo', async (req, res) => {
    try {
      const repoName = req.query.repo as string | undefined;
      const repo = await backend.resolveRepo(repoName);
      res.json({
        name: repo.name,
        path: repo.repoPath,
        indexedAt: repo.indexedAt,
        lastCommit: repo.lastCommit,
        stats: repo.stats || {},
      });
    } catch (err: any) {
      res.status(httpStatus(err))
        .json({ error: err.message || 'Repository not found' });
    }
  });

  // ─── GET /api/graph?repo=X ─────────────────────────────────────
  // Full knowledge graph (all nodes + relationships)
  app.get('/api/graph', async (req, res) => {
    try {
      const repoName = req.query.repo as string | undefined;
      // Resolve repo to validate it exists and get the name
      const repo = await backend.resolveRepo(repoName);
      const graph = await buildGraph(backend, repo.name);
      res.json(graph);
    } catch (err: any) {
      res.status(httpStatus(err))
        .json({ error: err.message || 'Failed to build graph' });
    }
  });

  // ─── POST /api/query ───────────────────────────────────────────
  // Execute a raw Cypher query.
  // This endpoint is intentionally unrestricted (no query validation) because
  // the server binds to 127.0.0.1 only — it exposes full graph query
  // capabilities to local clients by design.
  app.post('/api/query', async (req, res) => {
    try {
      const repoName = (req.body.repo ?? req.query.repo) as string | undefined;
      const cypher = req.body.cypher as string;

      if (!cypher) {
        res.status(400).json({ error: 'Missing "cypher" in request body' });
        return;
      }

      const result = await backend.executeCypher(repoName, cypher);
      if (result && !Array.isArray(result) && (result as any).error) {
        res.status(500).json({ error: (result as any).error });
        return;
      }
      res.json({ result });
    } catch (err: any) {
      res.status(httpStatus(err))
        .json({ error: err.message || 'Query failed' });
    }
  });

  // ─── POST /api/search ──────────────────────────────────────────
  // Process-grouped semantic search
  app.post('/api/search', async (req, res) => {
    try {
      const repoName = (req.body.repo ?? req.query.repo) as string | undefined;
      const query = (req.body.query ?? '').trim();
      const limit = req.body.limit as number | undefined;

      if (!query) {
        res.status(400).json({ error: 'Missing "query" in request body' });
        return;
      }

      const results = await backend.callTool('query', {
        repo: repoName,
        query,
        limit,
      });
      res.json({ results });
    } catch (err: any) {
      res.status(httpStatus(err))
        .json({ error: err.message || 'Search failed' });
    }
  });

  // ─── GET /api/file?repo=X&path=Y ──────────────────────────────
  // Read a file from a resolved repo path on disk
  app.get('/api/file', async (req, res) => {
    try {
      const repoName = req.query.repo as string | undefined;
      const filePath = req.query.path as string;

      if (!filePath) {
        res.status(400).json({ error: 'Missing "path" query parameter' });
        return;
      }

      const repo = await backend.resolveRepo(repoName);

      // Resolve the full path and validate it stays within the repo root
      const repoRoot = path.resolve(repo.repoPath);
      const fullPath = path.resolve(repoRoot, filePath);

      if (!fullPath.startsWith(repoRoot + path.sep) && fullPath !== repoRoot) {
        res.status(403).json({ error: 'Path traversal denied: path escapes repo root' });
        return;
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      res.json({ content });
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        res.status(404).json({ error: 'File not found' });
      } else {
        res.status(httpStatus(err))
          .json({ error: err.message || 'Failed to read file' });
      }
    }
  });

  // ─── GET /api/processes?repo=X ─────────────────────────────────
  // List all processes for a repo
  app.get('/api/processes', async (req, res) => {
    try {
      const repoName = req.query.repo as string | undefined;
      const result = await backend.queryProcesses(repoName);
      res.json(result);
    } catch (err: any) {
      res.status(httpStatus(err))
        .json({ error: err.message || 'Failed to query processes' });
    }
  });

  // ─── GET /api/process?repo=X&name=Y ───────────────────────────
  // Get detailed process info including steps
  app.get('/api/process', async (req, res) => {
    try {
      const repoName = req.query.repo as string | undefined;
      const name = req.query.name as string;

      if (!name) {
        res.status(400).json({ error: 'Missing "name" query parameter' });
        return;
      }

      const result = await backend.queryProcessDetail(name, repoName);
      if (result.error) {
        res.status(404).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err: any) {
      res.status(httpStatus(err))
        .json({ error: err.message || 'Failed to query process detail' });
    }
  });

  // ─── GET /api/clusters?repo=X ─────────────────────────────────
  // List all clusters for a repo
  app.get('/api/clusters', async (req, res) => {
    try {
      const repoName = req.query.repo as string | undefined;
      const result = await backend.queryClusters(repoName);
      res.json(result);
    } catch (err: any) {
      res.status(httpStatus(err))
        .json({ error: err.message || 'Failed to query clusters' });
    }
  });

  // ─── GET /api/cluster?repo=X&name=Y ───────────────────────────
  // Get detailed cluster info including members
  app.get('/api/cluster', async (req, res) => {
    try {
      const repoName = req.query.repo as string | undefined;
      const name = req.query.name as string;

      if (!name) {
        res.status(400).json({ error: 'Missing "name" query parameter' });
        return;
      }

      const result = await backend.queryClusterDetail(name, repoName);
      if (result.error) {
        res.status(404).json({ error: result.error });
        return;
      }
      res.json(result);
    } catch (err: any) {
      res.status(httpStatus(err))
        .json({ error: err.message || 'Failed to query cluster detail' });
    }
  });

  // ─── POST /api/keys ───────────────────────────────────────────
  // Create a new API key (returns key once)
  app.post('/api/keys', requireApiKey({ scopes: ['admin'], allowIfNoKeys: true }), (req, res) => {
    const name = (req.body?.name ?? '').trim();
    const scopes = Array.isArray(req.body?.scopes) ? req.body.scopes : ['read'];

    if (!name) {
      res.status(400).json({ error: 'Missing "name" in request body' });
      return;
    }

    const validScopes = scopes.filter((scope: string) => ['read', 'write', 'admin'].includes(scope));
    const result = createApiKey(name, validScopes.length ? validScopes : ['read']);
    res.json(result);
  });

  // ─── GET /api/keys ────────────────────────────────────────────
  // List API keys (masked)
  app.get('/api/keys', requireApiKey({ scopes: ['admin'] }), (_req, res) => {
    const keys = listApiKeys().map((key) => ({
      ...key,
      id: key.id,
      masked: `${key.id.slice(0, 6)}…${key.id.slice(-4)}`,
    }));
    res.json(keys);
  });

  // ─── DELETE /api/keys/:id ─────────────────────────────────────
  // Revoke an API key
  app.delete('/api/keys/:id', requireApiKey({ scopes: ['admin'] }), (req, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Missing key id' });
      return;
    }
    const revoked = revokeApiKey(id);
    res.json({ revoked });
  });

  // ─── POST /api/llm-credentials ───────────────────────────────
  // Store an LLM provider API key
  app.post('/api/llm-credentials', requireApiKey({ scopes: ['admin'] }), (req, res) => {
    let provider = (req.body?.provider ?? '').trim().toLowerCase();
    const apiKey = (req.body?.apiKey ?? '').trim();

    if (!provider || !apiKey) {
      res.status(400).json({ error: 'Missing "provider" or "apiKey" in request body' });
      return;
    }

    if (provider === 'claude') {
      provider = 'anthropic';
    }

    if (!['openai', 'anthropic', 'gemini', 'cursor'].includes(provider)) {
      res.status(400).json({ error: 'Unsupported provider' });
      return;
    }

    storeLLMCredential(provider as any, apiKey);
    res.json({ stored: true });
  });

  // ─── GET /api/llm-credentials ────────────────────────────────
  // List configured LLM providers
  app.get('/api/llm-credentials', requireApiKey({ scopes: ['admin'] }), (_req, res) => {
    res.json(listLLMCredentials());
  });

  // ─── POST /api/github/credentials ────────────────────────────
  // Store GitHub PAT for user/org/repos
  app.post('/api/github/credentials', requireApiKey({ scopes: ['admin'] }), (req, res) => {
    const type = (req.body?.type ?? '').trim();
    const owner = (req.body?.owner ?? '').trim();
    const token = (req.body?.token ?? '').trim();

    if (!type || !owner || !token) {
      res.status(400).json({ error: 'Missing "type", "owner", or "token" in request body' });
      return;
    }

    if (!['user', 'org', 'repos'].includes(type)) {
      res.status(400).json({ error: 'Unsupported credential type' });
      return;
    }

    storeGitHubCredential(type as any, owner, token);
    res.json({ stored: true });
  });

  // ─── GET /api/github/credentials ─────────────────────────────
  // List stored GitHub credentials (masked)
  app.get('/api/github/credentials', requireApiKey({ scopes: ['admin'] }), (_req, res) => {
    res.json(listGitHubCredentials());
  });

  // ─── POST /api/github/scan ───────────────────────────────────
  // Scan GitHub repos and enqueue indexing jobs
  app.post('/api/github/scan', requireApiKey({ scopes: ['write'] }), (req, res) => {
    const type = (req.body?.type ?? '').trim();
    const target = (req.body?.target ?? '').trim();
    const token = (req.body?.token ?? '').trim();
    const force = Boolean(req.body?.force);

    if (!type || !target) {
      res.status(400).json({ error: 'Missing "type" or "target" in request body' });
      return;
    }

    if (!['user', 'org', 'repos'].includes(type)) {
      res.status(400).json({ error: 'Unsupported scan type' });
      return;
    }

    const job = enqueueGitHubScan({ type, target, token: token || undefined, force });
    res.json(job);
  });

  // ─── GET /api/github/jobs ────────────────────────────────────
  // List GitHub scan jobs
  app.get('/api/github/jobs', requireApiKey({ scopes: ['read'] }), (_req, res) => {
    res.json(listGitHubJobs());
  });

  // ─── POST /api/contributors/extract ──────────────────────────
  // Extract contributor data from git history + GitHub API
  app.post('/api/contributors/extract', requireApiKey({ scopes: ['write'] }), async (req, res) => {
    try {
      const repoName = req.body?.repo as string | undefined;
      const githubOwner = req.body?.githubOwner as string | undefined;
      const githubRepo = req.body?.githubRepo as string | undefined;
      const githubToken = req.body?.githubToken as string | undefined;

      const repo = await backend.resolveRepo(repoName);
      const result = await extractAndStoreContributors(repo.repoPath, {
        repoName: repo.name,
        githubOwner,
        githubRepo,
        githubToken,
      });
      res.json(result);
    } catch (err: any) {
      res.status(httpStatus(err)).json({ error: err.message || 'Failed to extract contributors' });
    }
  });

  // ─── GET /api/contributors?repo=X ─────────────────────────────
  // List contributors for a repo
  app.get('/api/contributors', requireApiKey({ scopes: ['read'] }), async (req, res) => {
    try {
      const repoName = req.query.repo as string | undefined;
      const repo = await backend.resolveRepo(repoName);
      const contributors = await listContributorsByRepo(repo.repoPath, repo.name);
      res.json(contributors);
    } catch (err: any) {
      res.status(httpStatus(err)).json({ error: err.message || 'Failed to list contributors' });
    }
  });

  // ─── GET /api/contributor/:id ────────────────────────────────
  // Contributor details + files touched
  app.get('/api/contributor/:id', requireApiKey({ scopes: ['read'] }), async (req, res) => {
    try {
      const repoName = req.query.repo as string | undefined;
      const contributorId = req.params.id;
      if (!contributorId) {
        res.status(400).json({ error: 'Missing contributor id' });
        return;
      }

      const repo = await backend.resolveRepo(repoName);
      const [contributors, files] = await Promise.all([
        listContributorsByRepo(repo.repoPath, repo.name),
        listContributorFiles(repo.repoPath, repo.name, contributorId),
      ]);
      const contributor = contributors.find((entry) => entry.id === contributorId);
      res.json({ contributor, files });
    } catch (err: any) {
      res.status(httpStatus(err)).json({ error: err.message || 'Failed to fetch contributor' });
    }
  });

  // ─── GET /api/contributor/:id/similar ────────────────────────
  // Similar contributors in repo
  app.get('/api/contributor/:id/similar', requireApiKey({ scopes: ['read'] }), async (req, res) => {
    try {
      const repoName = req.query.repo as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const contributorId = req.params.id;
      const repo = await backend.resolveRepo(repoName);
      const results = await getSimilarContributors(repo.repoPath, repo.name, contributorId, limit);
      res.json(results);
    } catch (err: any) {
      res.status(httpStatus(err)).json({ error: err.message || 'Failed to find similar contributors' });
    }
  });

  // ─── GET /api/file/contributors?repo=X&path=Y ────────────────
  // Who touched a file in a repo
  app.get('/api/file/contributors', requireApiKey({ scopes: ['read'] }), async (req, res) => {
    try {
      const repoName = req.query.repo as string | undefined;
      const filePath = req.query.path as string | undefined;
      if (!filePath) {
        res.status(400).json({ error: 'Missing "path" query parameter' });
        return;
      }

      const repo = await backend.resolveRepo(repoName);
      const contributors = await listFileContributors(repo.repoPath, filePath);
      res.json(contributors);
    } catch (err: any) {
      res.status(httpStatus(err)).json({ error: err.message || 'Failed to list file contributors' });
    }
  });

  // ─── GET /api/repo/:name/top-contributors ─────────────────────
  // Top contributors by files touched
  app.get('/api/repo/:name/top-contributors', requireApiKey({ scopes: ['read'] }), async (req, res) => {
    try {
      const repoName = req.params.name;
      const repo = await backend.resolveRepo(repoName);
      const contributors = await listContributorsByRepo(repo.repoPath, repo.name);
      res.json(contributors);
    } catch (err: any) {
      res.status(httpStatus(err)).json({ error: err.message || 'Failed to list top contributors' });
    }
  });

  // ─── GET /api/repo/:name/similar-repos ────────────────────────
  // Similar repos based on contributor overlap
  app.get('/api/repo/:name/similar-repos', requireApiKey({ scopes: ['read'] }), async (req, res) => {
    try {
      const repoName = req.params.name;
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const results = await getSimilarRepos(repoName, limit);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to find similar repos' });
    }
  });

  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`GitNexus server running on http://localhost:${port}`);
    console.log(`Serving ${hasRepos ? 'all indexed repositories' : 'no repositories (run gitnexus analyze first)'}`);
  });

  const shutdown = async () => {
    server.close();
    await backend.disconnect();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
};
