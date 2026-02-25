import { storeGitHubCredential } from '../storage/api-keys.js';
import { runGitHubScan } from '../services/github.js';

export const githubLoginCommand = async (opts: { type?: string; owner?: string; token?: string }) => {
  const type = (opts.type || 'user').trim();
  const owner = (opts.owner || '').trim();
  const token = (opts.token || process.env.GITHUB_TOKEN || '').trim();

  if (!owner || !token) {
    console.log('Missing required flags: --owner and --token (or GITHUB_TOKEN env var)');
    return;
  }

  if (!['user', 'org', 'repos'].includes(type)) {
    console.log('Invalid type. Use: user | org | repos');
    return;
  }

  storeGitHubCredential(type as any, owner, token);
  console.log(`Stored GitHub credential for ${type}:${owner}`);
};

export const githubScanCommand = async (
  target: string,
  opts: { type?: string; token?: string; force?: boolean },
) => {
  const type = (opts.type || 'user').trim();
  const token = (opts.token || '').trim();

  if (!target) {
    console.log('Missing scan target.');
    return;
  }

  if (!['user', 'org', 'repos'].includes(type)) {
    console.log('Invalid type. Use: user | org | repos');
    return;
  }

  console.log(`Starting GitHub scan: ${type}:${target}`);
  const job = await runGitHubScan({
    type: type as any,
    target,
    token: token || undefined,
    force: Boolean(opts.force),
  });

  if (job.status === 'failed') {
    console.log(`Scan failed: ${job.error || 'Unknown error'}`);
  } else {
    console.log(`Scan complete: ${job.processedRepos}/${job.totalRepos} repos indexed`);
  }
};
