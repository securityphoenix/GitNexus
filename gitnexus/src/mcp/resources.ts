/**
 * MCP Resources (Multi-Repo)
 * 
 * Provides structured on-demand data to AI agents.
 * All resources use repo-scoped URIs: gitnexus://repo/{name}/context
 */

import type { LocalBackend } from './local/local-backend.js';
import { checkStaleness } from './staleness.js';

export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
}

const yamlQuote = (value: string | number | undefined | null): string => {
  const raw = value === undefined || value === null ? '' : String(value);
  return `"${raw.replace(/"/g, '\\"')}"`;
};

/**
 * Static resources — includes per-repo resources and the global repos list
 */
export function getResourceDefinitions(): ResourceDefinition[] {
  return [
    {
      uri: 'gitnexus://repos',
      name: 'All Indexed Repositories',
      description: 'List of all indexed repos with stats. Read this first to discover available repos.',
      mimeType: 'text/yaml',
    },
    {
      uri: 'gitnexus://setup',
      name: 'GitNexus Setup Content',
      description: 'Returns AGENTS.md content for all indexed repos. Useful for setup/onboarding.',
      mimeType: 'text/markdown',
    },
  ];
}

/**
 * Dynamic resource templates
 */
export function getResourceTemplates(): ResourceTemplate[] {
  return [
    {
      uriTemplate: 'gitnexus://repo/{name}/context',
      name: 'Repo Overview',
      description: 'Codebase stats, staleness check, and available tools',
      mimeType: 'text/yaml',
    },
    {
      uriTemplate: 'gitnexus://repo/{name}/clusters',
      name: 'Repo Modules',
      description: 'All functional areas (Leiden clusters)',
      mimeType: 'text/yaml',
    },
    {
      uriTemplate: 'gitnexus://repo/{name}/processes',
      name: 'Repo Processes',
      description: 'All execution flows',
      mimeType: 'text/yaml',
    },
    {
      uriTemplate: 'gitnexus://repo/{name}/schema',
      name: 'Graph Schema',
      description: 'Node/edge schema for Cypher queries',
      mimeType: 'text/yaml',
    },
    {
      uriTemplate: 'gitnexus://repo/{name}/cluster/{clusterName}',
      name: 'Module Detail',
      description: 'Deep dive into a specific functional area',
      mimeType: 'text/yaml',
    },
    {
      uriTemplate: 'gitnexus://repo/{name}/process/{processName}',
      name: 'Process Trace',
      description: 'Step-by-step execution trace',
      mimeType: 'text/yaml',
    },
    {
      uriTemplate: 'gitnexus://repo/{name}/contributors',
      name: 'Repo Contributors',
      description: 'Contributors and files touched',
      mimeType: 'text/yaml',
    },
    {
      uriTemplate: 'gitnexus://repo/{name}/contributor/{contributorId}',
      name: 'Contributor Detail',
      description: 'Files touched by a contributor with stats',
      mimeType: 'text/yaml',
    },
    {
      uriTemplate: 'gitnexus://repo/{name}/contributor/{contributorId}/similar',
      name: 'Similar Contributors',
      description: 'Contributors with overlapping file activity',
      mimeType: 'text/yaml',
    },
    {
      uriTemplate: 'gitnexus://repo/{name}/file/{filePath}/contributors',
      name: 'File Contributors',
      description: 'Contributors who touched a file',
      mimeType: 'text/yaml',
    },
    {
      uriTemplate: 'gitnexus://repo/{name}/similar-repos',
      name: 'Similar Repos',
      description: 'Repositories with overlapping contributors',
      mimeType: 'text/yaml',
    },
  ];
}

/**
 * Parse a resource URI to extract the repo name and resource type.
 */
function parseUri(uri: string): { repoName?: string; resourceType: string; param?: string } {
  if (uri === 'gitnexus://repos') return { resourceType: 'repos' };
  if (uri === 'gitnexus://setup') return { resourceType: 'setup' };

  // Repo-scoped: gitnexus://repo/{name}/context
  const repoMatch = uri.match(/^gitnexus:\/\/repo\/([^/]+)\/(.+)$/);
  if (repoMatch) {
    const repoName = decodeURIComponent(repoMatch[1]);
    const rest = repoMatch[2];

    if (rest.startsWith('cluster/')) {
      return { repoName, resourceType: 'cluster', param: decodeURIComponent(rest.replace('cluster/', '')) };
    }
    if (rest.startsWith('process/')) {
      return { repoName, resourceType: 'process', param: decodeURIComponent(rest.replace('process/', '')) };
    }
    if (rest === 'contributors') {
      return { repoName, resourceType: 'contributors' };
    }
    if (rest === 'similar-repos') {
      return { repoName, resourceType: 'similar-repos' };
    }
    if (rest.startsWith('contributor/')) {
      const remainder = rest.replace('contributor/', '');
      if (remainder.endsWith('/similar')) {
        const id = remainder.slice(0, -'/similar'.length);
        return { repoName, resourceType: 'contributor-similar', param: decodeURIComponent(id) };
      }
      return { repoName, resourceType: 'contributor', param: decodeURIComponent(remainder) };
    }
    if (rest.startsWith('file/')) {
      if (rest.endsWith('/contributors')) {
        const pathPart = rest.slice('file/'.length, -'/contributors'.length);
        return { repoName, resourceType: 'file-contributors', param: decodeURIComponent(pathPart) };
      }
    }

    return { repoName, resourceType: rest };
  }

  throw new Error(`Unknown resource URI: ${uri}`);
}

/**
 * Read a resource and return its content
 */
export async function readResource(uri: string, backend: LocalBackend): Promise<string> {
  const parsed = parseUri(uri);

  // Global repos list — no repo context needed
  if (parsed.resourceType === 'repos') {
    return getReposResource(backend);
  }
  
  // Setup resource — returns AGENTS.md content for all repos
  if (parsed.resourceType === 'setup') {
    return getSetupResource(backend);
  }

  const repoName = parsed.repoName;

  switch (parsed.resourceType) {
    case 'context':
      return getContextResource(backend, repoName);
    case 'clusters':
      return getClustersResource(backend, repoName);
    case 'processes':
      return getProcessesResource(backend, repoName);
    case 'schema':
      return getSchemaResource();
    case 'cluster':
      return getClusterDetailResource(parsed.param!, backend, repoName);
    case 'process':
      return getProcessDetailResource(parsed.param!, backend, repoName);
    case 'contributors':
      return getContributorsResource(backend, repoName);
    case 'contributor':
      return getContributorDetailResource(parsed.param!, backend, repoName);
    case 'contributor-similar':
      return getContributorSimilarResource(parsed.param!, backend, repoName);
    case 'file-contributors':
      return getFileContributorsResource(parsed.param!, backend, repoName);
    case 'similar-repos':
      return getSimilarReposResource(backend, repoName);
    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
}

// ─── Resource Implementations ─────────────────────────────────────────

/**
 * Repos resource — list all indexed repositories
 */
async function getReposResource(backend: LocalBackend): Promise<string> {
  const repos = await backend.listRepos();

  if (repos.length === 0) {
    return 'repos: []\n# No repositories indexed. Run: gitnexus analyze';
  }

  const lines: string[] = ['repos:'];
  for (const repo of repos) {
    lines.push(`  - name: "${repo.name}"`);
    lines.push(`    path: "${repo.path}"`);
    lines.push(`    indexed: "${repo.indexedAt}"`);
    lines.push(`    commit: "${repo.lastCommit?.slice(0, 7) || 'unknown'}"`);
    if (repo.stats) {
      lines.push(`    files: ${repo.stats.files || 0}`);
      lines.push(`    symbols: ${repo.stats.nodes || 0}`);
      lines.push(`    processes: ${repo.stats.processes || 0}`);
    }
  }

  if (repos.length > 1) {
    lines.push('');
    lines.push('# Multiple repos indexed. Use repo parameter in tool calls:');
    lines.push(`# gitnexus_search({query: "auth", repo: "${repos[0].name}"})`);
  }

  return lines.join('\n');
}

/**
 * Context resource — codebase overview for a specific repo
 */
async function getContextResource(backend: LocalBackend, repoName?: string): Promise<string> {
  // Resolve repo
  const repo = await backend.resolveRepo(repoName);
  const repoId = repo.name.toLowerCase();
  const context = backend.getContext(repoId) || backend.getContext();

  if (!context) {
    return 'error: No codebase loaded. Run: gitnexus analyze';
  }
  
  // Check staleness
  const repoPath = repo.repoPath;
  const lastCommit = repo.lastCommit || 'HEAD';
  const staleness = repoPath ? checkStaleness(repoPath, lastCommit) : { isStale: false, commitsBehind: 0 };
  
  const lines: string[] = [
    `project: ${context.projectName}`,
  ];
  
  if (staleness.isStale && staleness.hint) {
    lines.push('');
    lines.push(`staleness: "${staleness.hint}"`);
  }
  
  lines.push('');
  lines.push('stats:');
  lines.push(`  files: ${context.stats.fileCount}`);
  lines.push(`  symbols: ${context.stats.functionCount}`);
  lines.push(`  processes: ${context.stats.processCount}`);
  lines.push('');
  lines.push('tools_available:');
  lines.push('  - query: Process-grouped code intelligence (execution flows related to a concept)');
  lines.push('  - context: 360-degree symbol view (categorized refs, process participation)');
  lines.push('  - impact: Blast radius analysis (what breaks if you change a symbol)');
  lines.push('  - detect_changes: Git-diff impact analysis (what do your changes affect)');
  lines.push('  - rename: Multi-file coordinated rename with confidence tags');
  lines.push('  - cypher: Raw graph queries');
  lines.push('  - list_repos: Discover all indexed repositories');
  lines.push('  - contributors: List repo contributors and files touched');
  lines.push('  - contributor_files: Files touched by a contributor');
  lines.push('  - contributor_similar: Similar contributors by file overlap');
  lines.push('  - file_contributors: Contributors for a file');
  lines.push('  - repo_similar: Similar repos by contributor overlap');
  lines.push('');
  lines.push('re_index: Run `npx gitnexus analyze` in terminal if data is stale');
  lines.push('');
  lines.push('resources_available:');
  lines.push('  - gitnexus://repos: All indexed repositories');
  lines.push(`  - gitnexus://repo/${context.projectName}/clusters: All functional areas`);
  lines.push(`  - gitnexus://repo/${context.projectName}/processes: All execution flows`);
  lines.push(`  - gitnexus://repo/${context.projectName}/cluster/{name}: Module details`);
  lines.push(`  - gitnexus://repo/${context.projectName}/process/{name}: Process trace`);
  lines.push(`  - gitnexus://repo/${context.projectName}/contributors: Contributors`);
  lines.push(`  - gitnexus://repo/${context.projectName}/contributor/{id}: Contributor detail`);
  lines.push(`  - gitnexus://repo/${context.projectName}/contributor/{id}/similar: Similar contributors`);
  lines.push(`  - gitnexus://repo/${context.projectName}/file/{path}/contributors: File contributors`);
  lines.push(`  - gitnexus://repo/${context.projectName}/similar-repos: Similar repos`);
  
  return lines.join('\n');
}

/**
 * Clusters resource — queries graph directly via backend.queryClusters()
 */
async function getClustersResource(backend: LocalBackend, repoName?: string): Promise<string> {
  try {
    const result = await backend.queryClusters(repoName, 100);

    if (!result.clusters || result.clusters.length === 0) {
      return 'modules: []\n# No functional areas detected. Run: gitnexus analyze';
    }

    const displayLimit = 20;
    const lines: string[] = ['modules:'];
    const toShow = result.clusters.slice(0, displayLimit);

    for (const cluster of toShow) {
      const label = cluster.heuristicLabel || cluster.label || cluster.id;
      lines.push(`  - name: "${label}"`);
      lines.push(`    symbols: ${cluster.symbolCount || 0}`);
      if (cluster.cohesion) {
        lines.push(`    cohesion: ${(cluster.cohesion * 100).toFixed(0)}%`);
      }
    }

    if (result.clusters.length > displayLimit) {
      lines.push(`\n# Showing top ${displayLimit} of ${result.clusters.length} modules. Use gitnexus_query for deeper search.`);
    }

    return lines.join('\n');
  } catch (err: any) {
    return `error: ${err.message}`;
  }
}

/**
 * Processes resource — queries graph directly via backend.queryProcesses()
 */
async function getProcessesResource(backend: LocalBackend, repoName?: string): Promise<string> {
  try {
    const result = await backend.queryProcesses(repoName, 50);

    if (!result.processes || result.processes.length === 0) {
      return 'processes: []\n# No processes detected. Run: gitnexus analyze';
    }

    const displayLimit = 20;
    const lines: string[] = ['processes:'];
    const toShow = result.processes.slice(0, displayLimit);

    for (const proc of toShow) {
      const label = proc.heuristicLabel || proc.label || proc.id;
      lines.push(`  - name: "${label}"`);
      lines.push(`    type: ${proc.processType || 'unknown'}`);
      lines.push(`    steps: ${proc.stepCount || 0}`);
    }

    if (result.processes.length > displayLimit) {
      lines.push(`\n# Showing top ${displayLimit} of ${result.processes.length} processes. Use gitnexus_query for deeper search.`);
    }

    return lines.join('\n');
  } catch (err: any) {
    return `error: ${err.message}`;
  }
}

/**
 * Schema resource — graph structure for Cypher queries
 */
function getSchemaResource(): string {
  return `# GitNexus Graph Schema

nodes:
  - File: Source code files
  - Folder: Directory containers
  - Function: Functions and arrow functions
  - Class: Class definitions
  - Interface: Interface/type definitions
  - Method: Class methods
  - CodeElement: Catch-all for other code elements
  - Community: Auto-detected functional area (Leiden algorithm)
  - Process: Execution flow trace
  - Contributor: Git contributors
  - FileContribution: Per-file contribution stats

additional_node_types: "Multi-language: Struct, Enum, Macro, Typedef, Union, Namespace, Trait, Impl, TypeAlias, Const, Static, Property, Record, Delegate, Annotation, Constructor, Template, Module (use backticks in queries: \`Struct\`, \`Enum\`, etc.)"

relationships:
  - CONTAINS: File/Folder contains child
  - DEFINES: File defines a symbol
  - CALLS: Function/method invocation
  - IMPORTS: Module imports
  - EXTENDS: Class inheritance
  - IMPLEMENTS: Interface implementation
  - MEMBER_OF: Symbol belongs to community
  - STEP_IN_PROCESS: Symbol is step N in process
  - CONTRIBUTED_TO: Contributor or FileContribution edge

relationship_table: "All relationships use a single CodeRelation table with a 'type' property. Properties: type (STRING), confidence (DOUBLE), reason (STRING), step (INT32)"

example_queries:
  find_callers: |
    MATCH (caller)-[:CodeRelation {type: 'CALLS'}]->(f:Function {name: "myFunc"})
    RETURN caller.name, caller.filePath
  
  find_community_members: |
    MATCH (s)-[:CodeRelation {type: 'MEMBER_OF'}]->(c:Community)
    WHERE c.heuristicLabel = "Auth"
    RETURN s.name, labels(s)[0] AS type
  
  trace_process: |
    MATCH (s)-[r:CodeRelation {type: 'STEP_IN_PROCESS'}]->(p:Process)
    WHERE p.heuristicLabel = "LoginFlow"
    RETURN s.name, r.step
    ORDER BY r.step
`;
}

/**
 * Cluster detail resource — queries graph directly via backend.queryClusterDetail()
 */
async function getClusterDetailResource(name: string, backend: LocalBackend, repoName?: string): Promise<string> {
  try {
    const result = await backend.queryClusterDetail(name, repoName);

    if (result.error) {
      return `error: ${result.error}`;
    }

    const cluster = result.cluster;
    const members = result.members || [];

    const lines: string[] = [
      `module: "${cluster.heuristicLabel || cluster.label || cluster.id}"`,
      `symbols: ${cluster.symbolCount || members.length}`,
    ];

    if (cluster.cohesion) {
      lines.push(`cohesion: ${(cluster.cohesion * 100).toFixed(0)}%`);
    }

    if (members.length > 0) {
      lines.push('');
      lines.push('members:');
      for (const member of members.slice(0, 20)) {
        lines.push(`  - name: ${member.name}`);
        lines.push(`    type: ${member.type}`);
        lines.push(`    file: ${member.filePath}`);
      }
      if (members.length > 20) {
        lines.push(`  # ... and ${members.length - 20} more`);
      }
    }

    return lines.join('\n');
  } catch (err: any) {
    return `error: ${err.message}`;
  }
}

/**
 * Process detail resource — queries graph directly via backend.queryProcessDetail()
 */
async function getProcessDetailResource(name: string, backend: LocalBackend, repoName?: string): Promise<string> {
  try {
    const result = await backend.queryProcessDetail(name, repoName);

    if (result.error) {
      return `error: ${result.error}`;
    }

    const proc = result.process;
    const steps = result.steps || [];

    const lines: string[] = [
      `name: "${proc.heuristicLabel || proc.label || proc.id}"`,
      `type: ${proc.processType || 'unknown'}`,
      `step_count: ${proc.stepCount || steps.length}`,
    ];

    if (steps.length > 0) {
      lines.push('');
      lines.push('trace:');
      for (const step of steps) {
        lines.push(`  ${step.step}: ${step.name} (${step.filePath})`);
      }
    }

    return lines.join('\n');
  } catch (err: any) {
    return `error: ${err.message}`;
  }
}

/**
 * Setup resource — generates AGENTS.md content for all indexed repos.
 * Useful for `gitnexus setup` onboarding or dynamic content injection.
 */
async function getSetupResource(backend: LocalBackend): Promise<string> {
  const repos = await backend.listRepos();

  if (repos.length === 0) {
    return '# GitNexus\n\nNo repositories indexed. Run: `npx gitnexus analyze` in a repository.';
  }
  
  const sections: string[] = [];
  
  for (const repo of repos) {
    const stats = repo.stats || {};
    const lines = [
      `# GitNexus MCP — ${repo.name}`,
      '',
      `This project is indexed by GitNexus as **${repo.name}** (${stats.nodes || 0} symbols, ${stats.edges || 0} relationships, ${stats.processes || 0} execution flows).`,
      '',
      '## Tools',
      '',
      '| Tool | What it gives you |',
      '|------|-------------------|',
      '| `query` | Process-grouped code intelligence — execution flows related to a concept |',
      '| `context` | 360-degree symbol view — categorized refs, processes it participates in |',
      '| `impact` | Symbol blast radius — what breaks at depth 1/2/3 with confidence |',
      '| `detect_changes` | Git-diff impact — what do your current changes affect |',
      '| `rename` | Multi-file coordinated rename with confidence-tagged edits |',
      '| `cypher` | Raw graph queries |',
      '| `list_repos` | Discover indexed repos |',
      '',
      '## Resources',
      '',
      `- \`gitnexus://repo/${repo.name}/context\` — Stats, staleness check`,
      `- \`gitnexus://repo/${repo.name}/clusters\` — All functional areas`,
      `- \`gitnexus://repo/${repo.name}/processes\` — All execution flows`,
      `- \`gitnexus://repo/${repo.name}/schema\` — Graph schema for Cypher`,
    ];
    sections.push(lines.join('\n'));
  }
  
  return sections.join('\n\n---\n\n');
}

// ─── Contributor Resources ─────────────────────────────────────────────

async function getContributorsResource(backend: LocalBackend, repoName?: string): Promise<string> {
  const repo = await backend.resolveRepo(repoName);
  const contributors = await backend.listContributors(repo, { limit: 50 });
  if (!contributors || contributors.length === 0) {
    return 'contributors: []\n# No contributor data found. Run contributor extraction.';
  }

  const lines: string[] = ['contributors:'];
  for (const c of contributors) {
    lines.push(`  - id: ${yamlQuote(c.id)}`);
    lines.push(`    name: ${yamlQuote(c.name || 'Unknown')}`);
    if (c.email) lines.push(`    email: ${yamlQuote(c.email)}`);
    if (c.githubUsername) lines.push(`    github_username: ${yamlQuote(c.githubUsername)}`);
    if (c.avatarUrl) lines.push(`    avatar_url: ${yamlQuote(c.avatarUrl)}`);
    lines.push(`    files_touched: ${c.filesTouched ?? 0}`);
  }
  return lines.join('\n');
}

async function getContributorDetailResource(id: string, backend: LocalBackend, repoName?: string): Promise<string> {
  const repo = await backend.resolveRepo(repoName);
  const [contributors, files] = await Promise.all([
    backend.listContributors(repo, { limit: 200 }),
    backend.listContributorFiles(repo, { contributor_id: id, limit: 100 }),
  ]);

  const contributor = contributors.find((c: any) => c.id === id);
  const lines: string[] = ['contributor:'];
  lines.push(`  id: ${yamlQuote(id)}`);
  if (contributor) {
    lines.push(`  name: ${yamlQuote(contributor.name || 'Unknown')}`);
    if (contributor.email) lines.push(`  email: ${yamlQuote(contributor.email)}`);
    if (contributor.githubUsername) lines.push(`  github_username: ${yamlQuote(contributor.githubUsername)}`);
    if (contributor.avatarUrl) lines.push(`  avatar_url: ${yamlQuote(contributor.avatarUrl)}`);
    lines.push(`  files_touched: ${contributor.filesTouched ?? 0}`);
  }

  lines.push('');
  lines.push('files:');
  if (!files || files.length === 0) {
    lines.push('  []');
    return lines.join('\n');
  }

  for (const f of files) {
    lines.push(`  - file: ${yamlQuote(f.filePath)}`);
    lines.push(`    commits: ${f.commits ?? 0}`);
    lines.push(`    lines_added: ${f.linesAdded ?? 0}`);
    lines.push(`    lines_deleted: ${f.linesDeleted ?? 0}`);
  }
  return lines.join('\n');
}

async function getContributorSimilarResource(id: string, backend: LocalBackend, repoName?: string): Promise<string> {
  const repo = await backend.resolveRepo(repoName);
  const similar = await backend.listSimilarContributors(repo, { contributor_id: id, limit: 10 });
  const lines: string[] = ['similar_contributors:'];

  if (!similar || similar.length === 0) {
    lines.push('  []');
    return lines.join('\n');
  }

  for (const c of similar) {
    lines.push(`  - id: ${yamlQuote(c.id)}`);
    lines.push(`    name: ${yamlQuote(c.name || 'Unknown')}`);
    if (c.email) lines.push(`    email: ${yamlQuote(c.email)}`);
    if (c.githubUsername) lines.push(`    github_username: ${yamlQuote(c.githubUsername)}`);
    lines.push(`    shared_files: ${c.sharedFiles ?? 0}`);
    lines.push(`    similarity: ${Number(c.similarity ?? 0).toFixed(3)}`);
  }
  return lines.join('\n');
}

async function getFileContributorsResource(filePath: string, backend: LocalBackend, repoName?: string): Promise<string> {
  const repo = await backend.resolveRepo(repoName);
  const contributors = await backend.listFileContributors(repo, { file_path: filePath });
  const lines: string[] = [`file: ${yamlQuote(filePath)}`, 'contributors:'];

  if (!contributors || contributors.length === 0) {
    lines.push('  []');
    return lines.join('\n');
  }

  for (const c of contributors) {
    lines.push(`  - id: ${yamlQuote(c.id)}`);
    lines.push(`    name: ${yamlQuote(c.name || 'Unknown')}`);
    if (c.email) lines.push(`    email: ${yamlQuote(c.email)}`);
    if (c.githubUsername) lines.push(`    github_username: ${yamlQuote(c.githubUsername)}`);
  }
  return lines.join('\n');
}

async function getSimilarReposResource(backend: LocalBackend, repoName?: string): Promise<string> {
  const repo = await backend.resolveRepo(repoName);
  const similar = await backend.listSimilarRepos(repo, { limit: 10 });
  const lines: string[] = ['similar_repos:'];

  if (!similar || similar.length === 0) {
    lines.push('  []');
    return lines.join('\n');
  }

  for (const r of similar) {
    lines.push(`  - name: ${yamlQuote(r.name)}`);
    lines.push(`    shared_contributors: ${r.sharedContributors ?? 0}`);
    lines.push(`    similarity: ${Number(r.similarity ?? 0).toFixed(3)}`);
  }
  return lines.join('\n');
}
