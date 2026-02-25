import { initKuzu, executeQuery, closeKuzu } from '../core/kuzu/kuzu-adapter.js';
import { getStoragePaths, listRegisteredRepos } from '../storage/repo-manager.js';

export interface SimilarContributorResult {
  id: string;
  name: string;
  email: string;
  githubUsername?: string;
  avatarUrl?: string;
  sharedFiles: number;
  similarity: number;
}

export interface SimilarRepoResult {
  name: string;
  sharedContributors: number;
  similarity: number;
}

export const getSimilarContributors = async (
  repoPath: string,
  repoName: string,
  contributorId: string,
  limit = 10,
): Promise<SimilarContributorResult[]> => {
  const { kuzuPath } = getStoragePaths(repoPath);
  await initKuzu(kuzuPath);

  const escapedRepo = repoName.replace(/'/g, "''");
  const escapedId = contributorId.replace(/'/g, "''");

  const rows = await executeQuery(`
    MATCH (c1:Contributor {id: '${escapedId}'})-[:CodeRelation {type: 'CONTRIBUTED_TO'}]->(fc1:FileContribution {repoName: '${escapedRepo}'})
    MATCH (c2:Contributor)-[:CodeRelation {type: 'CONTRIBUTED_TO'}]->(fc2:FileContribution {repoName: '${escapedRepo}'})
    WHERE c1.id <> c2.id AND fc1.filePath = fc2.filePath
    WITH c1, c2, COUNT(DISTINCT fc1.filePath) AS sharedFiles
    MATCH (c1)-[:CodeRelation {type: 'CONTRIBUTED_TO'}]->(fc1all:FileContribution {repoName: '${escapedRepo}'})
    WITH c1, c2, sharedFiles, COUNT(DISTINCT fc1all.filePath) AS c1Files
    MATCH (c2)-[:CodeRelation {type: 'CONTRIBUTED_TO'}]->(fc2all:FileContribution {repoName: '${escapedRepo}'})
    WITH c2, sharedFiles, c1Files, COUNT(DISTINCT fc2all.filePath) AS c2Files
    RETURN c2.id AS id,
           c2.name AS name,
           c2.email AS email,
           c2.githubUsername AS githubUsername,
           c2.avatarUrl AS avatarUrl,
           sharedFiles AS sharedFiles,
           (sharedFiles * 1.0 / (c1Files + c2Files - sharedFiles)) AS similarity
    ORDER BY similarity DESC
    LIMIT ${Number(limit) || 10}
  `);

  await closeKuzu();
  return rows.map((row) => ({
    id: row.id ?? row[0],
    name: row.name ?? row[1],
    email: row.email ?? row[2],
    githubUsername: row.githubUsername ?? row[3] ?? undefined,
    avatarUrl: row.avatarUrl ?? row[4] ?? undefined,
    sharedFiles: Number(row.sharedFiles ?? row[5] ?? 0),
    similarity: Number(row.similarity ?? row[6] ?? 0),
  }));
};

const getRepoContributorIds = async (repoPath: string, repoName: string): Promise<Set<string>> => {
  const { kuzuPath } = getStoragePaths(repoPath);
  await initKuzu(kuzuPath);
  const rows = await executeQuery(`
    MATCH (c:Contributor)-[:CodeRelation {type: 'CONTRIBUTED_TO'}]->(fc:FileContribution {repoName: '${repoName.replace(/'/g, "''")}'})
    RETURN DISTINCT c.id AS id
  `);
  await closeKuzu();
  const set = new Set<string>();
  for (const row of rows) {
    const id = String(row.id ?? row[0] ?? '');
    if (id) set.add(id);
  }
  return set;
};

export const getSimilarRepos = async (
  repoName: string,
  limit = 10,
): Promise<SimilarRepoResult[]> => {
  const repos = await listRegisteredRepos({ validate: true });
  const target = repos.find((repo) => repo.name === repoName);
  if (!target) return [];

  const targetContribs = await getRepoContributorIds(target.path, repoName);
  if (targetContribs.size === 0) return [];

  const results: SimilarRepoResult[] = [];
  for (const repo of repos) {
    if (repo.name === repoName) continue;
    const contribs = await getRepoContributorIds(repo.path, repo.name);
    if (contribs.size === 0) continue;

    let shared = 0;
    for (const id of contribs) {
      if (targetContribs.has(id)) shared += 1;
    }

    if (shared === 0) continue;
    const similarity = shared / (targetContribs.size + contribs.size - shared);
    results.push({
      name: repo.name,
      sharedContributors: shared,
      similarity,
    });
  }

  return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
};
