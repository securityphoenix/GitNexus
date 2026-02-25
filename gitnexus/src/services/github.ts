import fs from 'fs/promises';
import path from 'path';
import { Octokit } from '@octokit/rest';
import simpleGit from 'simple-git';
import { v4 as uuidv4 } from 'uuid';
import { getGlobalDir } from '../storage/repo-manager.js';
import { getGitHubCredential, GitHubCredentialType } from '../storage/api-keys.js';
import { runPipelineFromRepo } from '../core/ingestion/pipeline.js';
import { initKuzu, loadGraphToKuzu, getKuzuStats, closeKuzu, createFTSIndex } from '../core/kuzu/kuzu-adapter.js';
import { getStoragePaths, saveMeta, loadMeta, addToGitignore, registerRepo } from '../storage/repo-manager.js';
import { getCurrentCommit, isGitRepo } from '../storage/git.js';

export type GitHubScanType = 'user' | 'org' | 'repos';

export interface GitHubScanConfig {
  type: GitHubScanType;
  target: string;
  token?: string;
  force?: boolean;
}

export interface GitHubRepo {
  owner: string;
  repo: string;
  cloneUrl: string;
}

export interface GitHubScanJob {
  id: string;
  type: GitHubScanType;
  target: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  totalRepos: number;
  processedRepos: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  repos?: GitHubRepo[];
}

const jobs = new Map<string, GitHubScanJob>();
const JOB_HISTORY_LIMIT = 50;

const nowIso = (): string => new Date().toISOString();

const getCloneBaseDir = (): string => {
  return path.join(getGlobalDir(), 'remote-repos');
};

const parseRepoList = (input: string): GitHubRepo[] => {
  const items = input.split(',').map((s) => s.trim()).filter(Boolean);
  const repos: GitHubRepo[] = [];

  for (const item of items) {
    const cleaned = item.replace(/\.git$/, '');
    const match = cleaned.match(/github\.com\/([^\/]+)\/([^\/]+)/) ?? cleaned.match(/^([^\/]+)\/([^\/]+)$/);
    if (!match) continue;
    const owner = match[1];
    const repo = match[2];
    repos.push({
      owner,
      repo,
      cloneUrl: `https://github.com/${owner}/${repo}.git`,
    });
  }

  return repos;
};

const resolveToken = (type: GitHubCredentialType, target: string, override?: string): string | undefined => {
  if (override) return override;
  const stored = getGitHubCredential(type, target);
  return stored ?? undefined;
};

const listRepos = async (config: GitHubScanConfig): Promise<GitHubRepo[]> => {
  if (config.type === 'repos') {
    return parseRepoList(config.target);
  }

  const token = resolveToken(config.type, config.target, config.token);
  const octokit = new Octokit({ auth: token });

  if (config.type === 'org') {
    const repos = await octokit.paginate(octokit.repos.listForOrg, {
      org: config.target,
      per_page: 100,
    });
    return repos.map((repo) => ({
      owner: repo.owner?.login || config.target,
      repo: repo.name,
      cloneUrl: repo.clone_url,
    }));
  }

  const repos = await octokit.paginate(octokit.repos.listForUser, {
    username: config.target,
    per_page: 100,
  });
  return repos.map((repo) => ({
    owner: repo.owner?.login || config.target,
    repo: repo.name,
    cloneUrl: repo.clone_url,
  }));
};

const cloneOrUpdateRepo = async (repo: GitHubRepo, token?: string): Promise<string> => {
  const baseDir = getCloneBaseDir();
  const repoDir = path.join(baseDir, repo.owner, repo.repo);
  const gitDir = path.join(repoDir, '.git');

  await fs.mkdir(path.dirname(repoDir), { recursive: true });

  const authUrl = token
    ? `https://x-access-token:${token}@github.com/${repo.owner}/${repo.repo}.git`
    : repo.cloneUrl;

  try {
    await fs.access(gitDir);
    const git = simpleGit({ baseDir: repoDir });
    await git.fetch(['--prune']);
    await git.pull();
  } catch {
    const git = simpleGit();
    await git.clone(authUrl, repoDir, ['--depth', '1']);
  }

  return repoDir;
};

const indexRepo = async (repoPath: string, force?: boolean): Promise<void> => {
  if (!isGitRepo(repoPath)) {
    throw new Error(`Not a git repository: ${repoPath}`);
  }

  const { storagePath, kuzuPath } = getStoragePaths(repoPath);
  const currentCommit = getCurrentCommit(repoPath);
  const existingMeta = await loadMeta(storagePath);

  if (existingMeta && !force && existingMeta.lastCommit === currentCommit) {
    return;
  }

  const pipelineResult = await runPipelineFromRepo(repoPath, () => {});

  await closeKuzu();
  const kuzuFiles = [kuzuPath, `${kuzuPath}.wal`, `${kuzuPath}.lock`];
  for (const f of kuzuFiles) {
    try { await fs.rm(f, { recursive: true, force: true }); } catch {}
  }

  await initKuzu(kuzuPath);
  await loadGraphToKuzu(pipelineResult.graph, pipelineResult.fileContents, storagePath);

  try {
    await createFTSIndex('File', 'file_fts', ['name', 'content']);
    await createFTSIndex('Function', 'function_fts', ['name', 'content']);
    await createFTSIndex('Class', 'class_fts', ['name', 'content']);
    await createFTSIndex('Method', 'method_fts', ['name', 'content']);
    await createFTSIndex('Interface', 'interface_fts', ['name', 'content']);
  } catch {
    // Non-fatal
  }

  const stats = await getKuzuStats();
  const meta = {
    repoPath,
    lastCommit: currentCommit,
    indexedAt: new Date().toISOString(),
    stats: {
      files: pipelineResult.fileContents.size,
      nodes: stats.nodes,
      edges: stats.edges,
      communities: pipelineResult.communityResult?.stats.totalCommunities,
      processes: pipelineResult.processResult?.stats.totalProcesses,
    },
  };

  await saveMeta(storagePath, meta);
  await registerRepo(repoPath, meta);
  await addToGitignore(repoPath);
  await closeKuzu();
};

const enforceJobLimit = () => {
  const jobList = Array.from(jobs.values()).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  if (jobList.length <= JOB_HISTORY_LIMIT) return;
  for (const job of jobList.slice(0, jobList.length - JOB_HISTORY_LIMIT)) {
    jobs.delete(job.id);
  }
};

const runJob = async (job: GitHubScanJob, config: GitHubScanConfig) => {
  job.status = 'running';
  job.startedAt = nowIso();

  try {
    const repos = await listRepos(config);
    job.repos = repos;
    job.totalRepos = repos.length;

    const token = resolveToken(config.type, config.target, config.token);

    for (const repo of repos) {
      const repoPath = await cloneOrUpdateRepo(repo, token);
      await indexRepo(repoPath, config.force);
      job.processedRepos += 1;
    }

    job.status = 'completed';
    job.completedAt = nowIso();
  } catch (err: any) {
    job.status = 'failed';
    job.error = err?.message || 'GitHub scan failed';
    job.completedAt = nowIso();
  } finally {
    enforceJobLimit();
  }
};

export const enqueueGitHubScan = (config: GitHubScanConfig): GitHubScanJob => {
  const job: GitHubScanJob = {
    id: uuidv4(),
    type: config.type,
    target: config.target,
    status: 'queued',
    totalRepos: 0,
    processedRepos: 0,
    createdAt: nowIso(),
  };

  jobs.set(job.id, job);
  setTimeout(() => void runJob(job, config), 0);
  return job;
};

export const runGitHubScan = async (config: GitHubScanConfig): Promise<GitHubScanJob> => {
  const job: GitHubScanJob = {
    id: uuidv4(),
    type: config.type,
    target: config.target,
    status: 'queued',
    totalRepos: 0,
    processedRepos: 0,
    createdAt: nowIso(),
  };

  jobs.set(job.id, job);
  await runJob(job, config);
  return job;
};

export const listGitHubJobs = (): GitHubScanJob[] => {
  return Array.from(jobs.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};
