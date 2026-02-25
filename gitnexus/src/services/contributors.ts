import { execSync } from 'child_process';
import crypto from 'crypto';
import { Octokit } from '@octokit/rest';
import {
  initKuzu,
  executeWithReusedStatement,
  executeQuery,
  closeKuzu,
} from '../core/kuzu/kuzu-adapter.js';
import { getStoragePaths } from '../storage/repo-manager.js';
import { getGitHubCredential } from '../storage/api-keys.js';

export interface ContributorStats {
  id: string;
  name: string;
  email: string;
  githubUsername?: string;
  avatarUrl?: string;
  files: Map<string, FileContributionStats>;
}

export interface FileContributionStats {
  filePath: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
}

export interface ContributorExtractionOptions {
  repoName: string;
  githubOwner?: string;
  githubRepo?: string;
  githubToken?: string;
}

const hashId = (value: string): string => {
  return crypto.createHash('sha1').update(value).digest('hex');
};

const normalizeFilePath = (rawPath: string): string => {
  let cleaned = rawPath.trim();
  const arrowIndex = cleaned.lastIndexOf('=>');
  if (arrowIndex !== -1) {
    cleaned = cleaned.slice(arrowIndex + 2).trim();
  }
  cleaned = cleaned.replace(/[{}]/g, '').trim();
  return cleaned;
};

const parseGitLog = (repoPath: string): Map<string, ContributorStats> => {
  const output = execSync('git log --numstat --pretty=format:--%H|%an|%ae', {
    cwd: repoPath,
    maxBuffer: 1024 * 1024 * 200,
  }).toString('utf8');

  const contributors = new Map<string, ContributorStats>();
  let currentName = '';
  let currentEmail = '';

  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    if (line.startsWith('--')) {
      const parts = line.slice(2).split('|');
      currentName = (parts[1] || '').trim();
      currentEmail = (parts[2] || '').trim();
      continue;
    }

    const [addedRaw, deletedRaw, fileRaw] = line.split('\t');
    if (!fileRaw) continue;
    const filePath = normalizeFilePath(fileRaw);
    if (!filePath) continue;

    const added = addedRaw === '-' ? 0 : Number(addedRaw || 0);
    const deleted = deletedRaw === '-' ? 0 : Number(deletedRaw || 0);

    const contributorKey = currentEmail || currentName || 'unknown';
    let contributor = contributors.get(contributorKey);
    if (!contributor) {
      const id = `contrib_${hashId(contributorKey)}`;
      contributor = {
        id,
        name: currentName || 'Unknown',
        email: currentEmail || '',
        files: new Map<string, FileContributionStats>(),
      };
      contributors.set(contributorKey, contributor);
    }

    const existing = contributor.files.get(filePath);
    if (existing) {
      existing.commits += 1;
      existing.linesAdded += added;
      existing.linesDeleted += deleted;
    } else {
      contributor.files.set(filePath, {
        filePath,
        commits: 1,
        linesAdded: added,
        linesDeleted: deleted,
      });
    }
  }

  return contributors;
};

const parseGitHubUsername = (email: string): string | null => {
  if (!email) return null;
  const match = email.match(/([^@]+)@users\.noreply\.github\.com$/);
  if (!match) return null;
  const token = match[1];
  const parts = token.split('+');
  return parts[parts.length - 1] || null;
};

const enrichFromGitHub = async (
  contributors: Map<string, ContributorStats>,
  owner: string,
  repo: string,
  token?: string,
): Promise<void> => {
  const authToken = token ?? getGitHubCredential('repos', `${owner}/${repo}`) ?? getGitHubCredential('org', owner) ?? getGitHubCredential('user', owner);
  if (!authToken) return;

  const octokit = new Octokit({ auth: authToken });
  const data = await octokit.paginate(octokit.repos.listContributors, {
    owner,
    repo,
    per_page: 100,
  });

  const byLogin = new Map<string, { login: string; avatarUrl?: string }>();
  for (const entry of data) {
    if (!entry.login) continue;
    byLogin.set(entry.login.toLowerCase(), {
      login: entry.login,
      avatarUrl: entry.avatar_url || undefined,
    });
  }

  for (const contributor of contributors.values()) {
    const guessed = parseGitHubUsername(contributor.email);
    const nameKey = contributor.name.toLowerCase();
    const login = guessed?.toLowerCase() || nameKey;
    const match = byLogin.get(login);
    if (match) {
      contributor.githubUsername = match.login;
      contributor.avatarUrl = match.avatarUrl;
    }
  }
};

const upsertContributors = async (
  repoName: string,
  contributors: Map<string, ContributorStats>,
): Promise<void> => {
  const contributorParams = Array.from(contributors.values()).map((contrib) => ({
    id: contrib.id,
    name: contrib.name,
    email: contrib.email,
    githubUsername: contrib.githubUsername ?? '',
    avatarUrl: contrib.avatarUrl ?? '',
  }));

  await executeWithReusedStatement(
    `MERGE (c:Contributor {id: $id})
     SET c.name = $name,
         c.email = $email,
         c.githubUsername = $githubUsername,
         c.avatarUrl = $avatarUrl`,
    contributorParams,
  );

  const fileContributionParams: Array<Record<string, any>> = [];
  const edgeContributorFileParams: Array<Record<string, any>> = [];
  const edgeContributorContributionParams: Array<Record<string, any>> = [];
  const edgeContributionFileParams: Array<Record<string, any>> = [];

  for (const contrib of contributors.values()) {
    for (const fileStat of contrib.files.values()) {
      const fileContributionId = `fc_${hashId(`${contrib.id}:${fileStat.filePath}`)}`;
      fileContributionParams.push({
        id: fileContributionId,
        repoName,
        filePath: fileStat.filePath,
        commits: fileStat.commits,
        linesAdded: fileStat.linesAdded,
        linesDeleted: fileStat.linesDeleted,
      });

      edgeContributorFileParams.push({
        contributorId: contrib.id,
        filePath: fileStat.filePath,
      });

      edgeContributorContributionParams.push({
        contributorId: contrib.id,
        fileContributionId,
      });

      edgeContributionFileParams.push({
        fileContributionId,
        filePath: fileStat.filePath,
      });
    }
  }

  if (fileContributionParams.length > 0) {
    await executeWithReusedStatement(
      `MERGE (fc:FileContribution {id: $id})
       SET fc.repoName = $repoName,
           fc.filePath = $filePath,
           fc.commits = $commits,
           fc.linesAdded = $linesAdded,
           fc.linesDeleted = $linesDeleted`,
      fileContributionParams,
    );
  }

  if (edgeContributorFileParams.length > 0) {
    await executeWithReusedStatement(
      `MATCH (c:Contributor {id: $contributorId}), (f:File {filePath: $filePath})
       MERGE (c)-[:CodeRelation {type: 'CONTRIBUTED_TO', confidence: 1.0, reason: 'git-history', step: 0}]->(f)`,
      edgeContributorFileParams,
    );
  }

  if (edgeContributorContributionParams.length > 0) {
    await executeWithReusedStatement(
      `MATCH (c:Contributor {id: $contributorId}), (fc:FileContribution {id: $fileContributionId})
       MERGE (c)-[:CodeRelation {type: 'CONTRIBUTED_TO', confidence: 1.0, reason: 'git-history', step: 0}]->(fc)`,
      edgeContributorContributionParams,
    );
  }

  if (edgeContributionFileParams.length > 0) {
    await executeWithReusedStatement(
      `MATCH (fc:FileContribution {id: $fileContributionId}), (f:File {filePath: $filePath})
       MERGE (fc)-[:CodeRelation {type: 'CONTRIBUTED_TO', confidence: 1.0, reason: 'git-history', step: 0}]->(f)`,
      edgeContributionFileParams,
    );
  }
};

export const extractAndStoreContributors = async (
  repoPath: string,
  options: ContributorExtractionOptions,
): Promise<{ contributors: number; fileContributions: number }> => {
  const contributors = parseGitLog(repoPath);

  if (options.githubOwner && options.githubRepo) {
    await enrichFromGitHub(contributors, options.githubOwner, options.githubRepo, options.githubToken);
  }

  const { kuzuPath } = getStoragePaths(repoPath);
  await initKuzu(kuzuPath);
  await upsertContributors(options.repoName, contributors);
  await closeKuzu();

  const fileCount = Array.from(contributors.values()).reduce((sum, c) => sum + c.files.size, 0);
  return { contributors: contributors.size, fileContributions: fileCount };
};

export const listContributorsByRepo = async (repoPath: string, repoName: string) => {
  const { kuzuPath } = getStoragePaths(repoPath);
  await initKuzu(kuzuPath);
  const rows = await executeQuery(`
    MATCH (c:Contributor)-[:CodeRelation {type: 'CONTRIBUTED_TO'}]->(fc:FileContribution {repoName: '${repoName.replace(/'/g, "''")}'})
    RETURN c.id AS id, c.name AS name, c.email AS email, c.githubUsername AS githubUsername, c.avatarUrl AS avatarUrl, COUNT(fc) AS filesTouched
    ORDER BY filesTouched DESC
  `);
  await closeKuzu();
  return rows.map((row) => ({
    id: row.id ?? row[0],
    name: row.name ?? row[1],
    email: row.email ?? row[2],
    githubUsername: row.githubUsername ?? row[3] ?? undefined,
    avatarUrl: row.avatarUrl ?? row[4] ?? undefined,
    filesTouched: Number(row.filesTouched ?? row[5] ?? 0),
  }));
};

export const listContributorFiles = async (repoPath: string, repoName: string, contributorId: string) => {
  const { kuzuPath } = getStoragePaths(repoPath);
  await initKuzu(kuzuPath);
  const rows = await executeQuery(`
    MATCH (c:Contributor {id: '${contributorId.replace(/'/g, "''")}'})-[:CodeRelation {type: 'CONTRIBUTED_TO'}]->(fc:FileContribution {repoName: '${repoName.replace(/'/g, "''")}'})
    RETURN fc.filePath AS filePath, fc.commits AS commits, fc.linesAdded AS linesAdded, fc.linesDeleted AS linesDeleted
    ORDER BY commits DESC
  `);
  await closeKuzu();
  return rows.map((row) => ({
    filePath: row.filePath ?? row[0],
    commits: Number(row.commits ?? row[1] ?? 0),
    linesAdded: Number(row.linesAdded ?? row[2] ?? 0),
    linesDeleted: Number(row.linesDeleted ?? row[3] ?? 0),
  }));
};

export const listFileContributors = async (repoPath: string, filePath: string) => {
  const { kuzuPath } = getStoragePaths(repoPath);
  await initKuzu(kuzuPath);
  const rows = await executeQuery(`
    MATCH (c:Contributor)-[:CodeRelation {type: 'CONTRIBUTED_TO'}]->(f:File {filePath: '${filePath.replace(/'/g, "''")}'})
    RETURN c.id AS id, c.name AS name, c.email AS email, c.githubUsername AS githubUsername, c.avatarUrl AS avatarUrl
    ORDER BY c.name
  `);
  await closeKuzu();
  return rows.map((row) => ({
    id: row.id ?? row[0],
    name: row.name ?? row[1],
    email: row.email ?? row[2],
    githubUsername: row.githubUsername ?? row[3] ?? undefined,
    avatarUrl: row.avatarUrl ?? row[4] ?? undefined,
  }));
};
