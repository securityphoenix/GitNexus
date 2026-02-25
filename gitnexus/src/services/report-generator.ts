import fs from 'fs/promises';
import path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';
import { v4 as uuidv4 } from 'uuid';
import { getGlobalDir } from '../storage/repo-manager.js';
import { runPipelineFromRepo } from '../core/ingestion/pipeline.js';
import { initKuzu, loadGraphToKuzu, getKuzuStats, closeKuzu, createFTSIndex, executeQuery } from '../core/kuzu/kuzu-adapter.js';
import { getStoragePaths, saveMeta, loadMeta } from '../storage/repo-manager.js';
import { getCurrentCommit, isGitRepo } from '../storage/git.js';
import {
  RepoReport,
  ReportMetadata,
  RepoOverview,
  LanguageBreakdown,
  DirectoryStructure,
  DirectoryInfo,
  MainFileInfo,
  SymbolSummary,
  DependencyInfo,
  DependencyItem,
  DockerInfo,
  DockerfileInfo,
  DockerServiceInfo,
  DocumentationInfo,
  CodeAnalysisInfo,
  EntryPointInfo,
  ClusterInfo,
  ProcessInfo,
  ReportGeneratorOptions,
} from '../types/report.js';

const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  TypeScript: ['.ts', '.tsx', '.mts', '.cts'],
  JavaScript: ['.js', '.jsx', '.mjs', '.cjs'],
  Python: ['.py', '.pyw', '.pyi'],
  Java: ['.java'],
  'C#': ['.cs'],
  C: ['.c', '.h'],
  'C++': ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'],
  Go: ['.go'],
  Rust: ['.rs'],
  Ruby: ['.rb', '.rake'],
  PHP: ['.php'],
  Swift: ['.swift'],
  Kotlin: ['.kt', '.kts'],
  Scala: ['.scala'],
  Shell: ['.sh', '.bash', '.zsh'],
  YAML: ['.yml', '.yaml'],
  JSON: ['.json'],
  Markdown: ['.md', '.markdown'],
  HTML: ['.html', '.htm'],
  CSS: ['.css', '.scss', '.sass', '.less'],
  SQL: ['.sql'],
};

const getLanguageFromExtension = (ext: string): string => {
  for (const [lang, exts] of Object.entries(LANGUAGE_EXTENSIONS)) {
    if (exts.includes(ext.toLowerCase())) return lang;
  }
  return 'Other';
};

const countLines = (content: string): number => {
  return content.split('\n').length;
};

const parseRepoUrl = (url: string): { owner: string; repo: string } => {
  const cleaned = url.replace(/\.git$/, '');
  const match = cleaned.match(/github\.com\/([^\/]+)\/([^\/]+)/) ?? cleaned.match(/^([^\/]+)\/([^\/]+)$/);
  if (!match) throw new Error(`Invalid repo URL: ${url}`);
  return { owner: match[1], repo: match[2] };
};

const generateDirectoryTree = async (repoPath: string, maxDepth: number = 3): Promise<string> => {
  const lines: string[] = [];
  
  const walk = async (dir: string, prefix: string, depth: number) => {
    if (depth > maxDepth) return;
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const filtered = entries.filter(e => 
        !e.name.startsWith('.') && 
        e.name !== 'node_modules' && 
        e.name !== '__pycache__' &&
        e.name !== 'dist' &&
        e.name !== 'build' &&
        e.name !== '.git'
      );
      
      for (let i = 0; i < filtered.length; i++) {
        const entry = filtered[i];
        const isLast = i === filtered.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const newPrefix = isLast ? '    ' : '│   ';
        
        lines.push(`${prefix}${connector}${entry.name}${entry.isDirectory() ? '/' : ''}`);
        
        if (entry.isDirectory()) {
          await walk(path.join(dir, entry.name), prefix + newPrefix, depth + 1);
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  };
  
  lines.push(path.basename(repoPath) + '/');
  await walk(repoPath, '', 1);
  return lines.join('\n');
};

const findPackageManager = async (repoPath: string): Promise<string | null> => {
  const checks = [
    { file: 'package.json', manager: 'npm/yarn' },
    { file: 'requirements.txt', manager: 'pip' },
    { file: 'Pipfile', manager: 'pipenv' },
    { file: 'pyproject.toml', manager: 'poetry/pip' },
    { file: 'Cargo.toml', manager: 'cargo' },
    { file: 'go.mod', manager: 'go modules' },
    { file: 'pom.xml', manager: 'maven' },
    { file: 'build.gradle', manager: 'gradle' },
    { file: 'Gemfile', manager: 'bundler' },
    { file: 'composer.json', manager: 'composer' },
  ];
  
  for (const { file, manager } of checks) {
    try {
      await fs.access(path.join(repoPath, file));
      return manager;
    } catch {
      // File doesn't exist
    }
  }
  return null;
};

const parseDependencies = async (repoPath: string): Promise<DependencyInfo> => {
  const result: DependencyInfo = {
    packageManager: await findPackageManager(repoPath),
    dependencies: [],
    devDependencies: [],
    totalDependencies: 0,
    outdatedCount: 0,
    securityIssues: 0,
  };
  
  // Try package.json (Node.js)
  try {
    const pkgPath = path.join(repoPath, 'package.json');
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);
    
    if (pkg.dependencies) {
      for (const [name, version] of Object.entries(pkg.dependencies)) {
        result.dependencies.push({ name, version: String(version), type: 'runtime' });
      }
    }
    if (pkg.devDependencies) {
      for (const [name, version] of Object.entries(pkg.devDependencies)) {
        result.devDependencies.push({ name, version: String(version), type: 'dev' });
      }
    }
  } catch {
    // No package.json
  }
  
  // Try requirements.txt (Python)
  try {
    const reqPath = path.join(repoPath, 'requirements.txt');
    const content = await fs.readFile(reqPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    
    for (const line of lines) {
      const match = line.match(/^([a-zA-Z0-9_-]+)([=<>!~]+.*)?/);
      if (match) {
        result.dependencies.push({
          name: match[1],
          version: match[2] || '*',
          type: 'runtime',
        });
      }
    }
  } catch {
    // No requirements.txt
  }
  
  result.totalDependencies = result.dependencies.length + result.devDependencies.length;
  return result;
};

const parseDockerInfo = async (repoPath: string): Promise<DockerInfo | null> => {
  const result: DockerInfo = {
    hasDockerfile: false,
    hasDockerCompose: false,
    dockerfiles: [],
    services: [],
    baseImages: [],
  };
  
  // Find Dockerfiles
  const findDockerfiles = async (dir: string): Promise<string[]> => {
    const files: string[] = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...await findDockerfiles(fullPath));
        } else if (entry.name === 'Dockerfile' || entry.name.startsWith('Dockerfile.')) {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip inaccessible
    }
    return files;
  };
  
  const dockerfilePaths = await findDockerfiles(repoPath);
  result.hasDockerfile = dockerfilePaths.length > 0;
  
  for (const dfPath of dockerfilePaths) {
    try {
      const content = await fs.readFile(dfPath, 'utf-8');
      const lines = content.split('\n');
      
      const baseImages: string[] = [];
      const exposedPorts: number[] = [];
      const commands: string[] = [];
      let stages = 0;
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('FROM ')) {
          stages++;
          const image = trimmed.replace('FROM ', '').split(' ')[0];
          baseImages.push(image);
          if (!result.baseImages.includes(image)) {
            result.baseImages.push(image);
          }
        }
        if (trimmed.startsWith('EXPOSE ')) {
          const ports = trimmed.replace('EXPOSE ', '').split(/\s+/);
          for (const p of ports) {
            const port = parseInt(p);
            if (!isNaN(port)) exposedPorts.push(port);
          }
        }
        if (trimmed.startsWith('RUN ') || trimmed.startsWith('CMD ') || trimmed.startsWith('ENTRYPOINT ')) {
          commands.push(trimmed);
        }
      }
      
      result.dockerfiles.push({
        path: path.relative(repoPath, dfPath),
        baseImage: baseImages[0] || 'unknown',
        stages,
        exposedPorts,
        commands: commands.slice(0, 10),
      });
    } catch {
      // Skip unreadable
    }
  }
  
  // Check for docker-compose
  const composeFiles = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
  for (const cf of composeFiles) {
    try {
      const composePath = path.join(repoPath, cf);
      const content = await fs.readFile(composePath, 'utf-8');
      result.hasDockerCompose = true;
      
      // Simple YAML parsing for services
      const serviceMatch = content.match(/services:\s*\n([\s\S]*?)(?=\n\w|\n$|$)/);
      if (serviceMatch) {
        const servicesBlock = serviceMatch[1];
        const serviceNames = servicesBlock.match(/^\s{2}(\w[\w-]*):/gm);
        if (serviceNames) {
          for (const sn of serviceNames) {
            const name = sn.trim().replace(':', '');
            result.services.push({
              name,
              image: '',
              ports: [],
              volumes: [],
              depends_on: [],
            });
          }
        }
      }
      break;
    } catch {
      // No compose file
    }
  }
  
  if (!result.hasDockerfile && !result.hasDockerCompose) {
    return null;
  }
  
  return result;
};

const parseDocumentation = async (repoPath: string): Promise<DocumentationInfo> => {
  const result: DocumentationInfo = {
    hasReadme: false,
    readmePath: null,
    readmeContent: null,
    hasContributing: false,
    hasChangelog: false,
    hasLicense: false,
    licenseName: null,
    additionalDocs: [],
  };
  
  // Check for README
  const readmeNames = ['README.md', 'README.MD', 'readme.md', 'README', 'README.txt', 'README.rst'];
  for (const name of readmeNames) {
    try {
      const readmePath = path.join(repoPath, name);
      const content = await fs.readFile(readmePath, 'utf-8');
      result.hasReadme = true;
      result.readmePath = name;
      result.readmeContent = content.slice(0, 5000); // First 5000 chars
      break;
    } catch {
      // Try next
    }
  }
  
  // Check for CONTRIBUTING
  try {
    await fs.access(path.join(repoPath, 'CONTRIBUTING.md'));
    result.hasContributing = true;
  } catch {}
  
  // Check for CHANGELOG
  const changelogNames = ['CHANGELOG.md', 'CHANGELOG', 'HISTORY.md', 'CHANGES.md'];
  for (const name of changelogNames) {
    try {
      await fs.access(path.join(repoPath, name));
      result.hasChangelog = true;
      break;
    } catch {}
  }
  
  // Check for LICENSE
  const licenseNames = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING'];
  for (const name of licenseNames) {
    try {
      const licensePath = path.join(repoPath, name);
      const content = await fs.readFile(licensePath, 'utf-8');
      result.hasLicense = true;
      
      // Try to detect license type
      if (content.includes('MIT License')) result.licenseName = 'MIT';
      else if (content.includes('Apache License')) result.licenseName = 'Apache-2.0';
      else if (content.includes('GNU GENERAL PUBLIC LICENSE')) result.licenseName = 'GPL';
      else if (content.includes('BSD')) result.licenseName = 'BSD';
      else if (content.includes('ISC')) result.licenseName = 'ISC';
      else if (content.includes('PolyForm')) result.licenseName = 'PolyForm';
      break;
    } catch {}
  }
  
  // Check for docs directory
  try {
    const docsPath = path.join(repoPath, 'docs');
    const entries = await fs.readdir(docsPath);
    result.additionalDocs = entries.filter(e => e.endsWith('.md')).slice(0, 10);
  } catch {}
  
  return result;
};

export const generateReport = async (
  options: ReportGeneratorOptions,
  onProgress?: (message: string, percent: number) => void
): Promise<{ report: RepoReport; markdown: string; outputPath: string }> => {
  const { repoUrl, outputDir, includeCode = false, token, cleanup = true } = options;
  const { owner, repo } = parseRepoUrl(repoUrl);
  
  const globalDir = getGlobalDir();
  const tempDir = path.join(globalDir, 'temp-reports', uuidv4());
  const repoPath = path.join(tempDir, repo);
  const reportsDir = outputDir || path.join(globalDir, 'reports');
  
  await fs.mkdir(tempDir, { recursive: true });
  await fs.mkdir(reportsDir, { recursive: true });
  
  const progress = onProgress || (() => {});
  
  try {
    // Clone repository
    progress('Cloning repository...', 5);
    const authUrl = token
      ? `https://x-access-token:${token}@github.com/${owner}/${repo}.git`
      : `https://github.com/${owner}/${repo}.git`;
    
    const git: SimpleGit = simpleGit();
    await git.clone(authUrl, repoPath, ['--depth', '1']);
    
    progress('Repository cloned, analyzing...', 15);
    
    // Get commit info
    const repoGit: SimpleGit = simpleGit(repoPath);
    const log = await repoGit.log({ maxCount: 1 });
    const commit = log.latest?.hash?.slice(0, 7) || 'unknown';
    const branch = (await repoGit.branch()).current || 'main';
    
    // Run pipeline
    progress('Running code analysis pipeline...', 20);
    const pipelineResult = await runPipelineFromRepo(repoPath, (p) => {
      const pipelinePercent = 20 + (p.percent * 0.5);
      progress(p.message, Math.round(pipelinePercent));
    });
    
    progress('Building knowledge graph...', 75);
    
    // Setup temporary KuzuDB
    const { storagePath, kuzuPath } = getStoragePaths(repoPath);
    await closeKuzu();
    try { await fs.rm(kuzuPath, { recursive: true, force: true }); } catch {}
    
    await initKuzu(kuzuPath);
    await loadGraphToKuzu(pipelineResult.graph, pipelineResult.fileContents, storagePath);
    
    try {
      await createFTSIndex('File', 'file_fts', ['name', 'content']);
      await createFTSIndex('Function', 'function_fts', ['name', 'content']);
    } catch {}
    
    const stats = await getKuzuStats();
    
    // Analyze languages
    progress('Analyzing language distribution...', 80);
    const languageStats = new Map<string, { files: number; lines: number; extensions: Set<string> }>();
    let totalLines = 0;
    
    for (const [filePath, content] of pipelineResult.fileContents) {
      const ext = path.extname(filePath);
      const lang = getLanguageFromExtension(ext);
      const lines = countLines(content);
      totalLines += lines;
      
      if (!languageStats.has(lang)) {
        languageStats.set(lang, { files: 0, lines: 0, extensions: new Set() });
      }
      const langStat = languageStats.get(lang)!;
      langStat.files++;
      langStat.lines += lines;
      langStat.extensions.add(ext);
    }
    
    const languages: LanguageBreakdown[] = Array.from(languageStats.entries())
      .map(([language, stat]) => ({
        language,
        files: stat.files,
        lines: stat.lines,
        percentage: Math.round((stat.lines / totalLines) * 100),
        extensions: Array.from(stat.extensions),
      }))
      .sort((a, b) => b.lines - a.lines);
    
    const primaryLanguage = languages[0]?.language || 'Unknown';
    
    // Generate directory tree
    progress('Generating directory structure...', 82);
    const tree = await generateDirectoryTree(repoPath);
    
    // Get top-level directories
    const topLevelDirs: DirectoryInfo[] = [];
    try {
      const entries = await fs.readdir(repoPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const dirPath = path.join(repoPath, entry.name);
          let fileCount = 0;
          const countFiles = async (dir: string) => {
            try {
              const items = await fs.readdir(dir, { withFileTypes: true });
              for (const item of items) {
                if (item.isFile()) fileCount++;
                else if (item.isDirectory() && !item.name.startsWith('.')) {
                  await countFiles(path.join(dir, item.name));
                }
              }
            } catch {}
          };
          await countFiles(dirPath);
          
          topLevelDirs.push({
            name: entry.name,
            path: entry.name,
            fileCount,
            description: '',
          });
        }
      }
    } catch {}
    
    // Find main files
    progress('Identifying main files...', 85);
    const mainFiles: MainFileInfo[] = [];
    
    // Query for important symbols
    const symbolQuery = `
      MATCH (f:File)-[:DEFINES]->(s)
      WHERE s.label IN ['Function', 'Class', 'Interface']
      RETURN f.path as path, f.name as name, count(s) as symbolCount
      ORDER BY symbolCount DESC
      LIMIT 20
    `;
    
    try {
      const symbolResults = await executeQuery(symbolQuery);
      for (const row of symbolResults) {
        const filePath = row.path as string;
        const content = pipelineResult.fileContents.get(filePath);
        if (!content) continue;
        
        const ext = path.extname(filePath);
        const lang = getLanguageFromExtension(ext);
        const lines = countLines(content);
        
        // Get symbols for this file
        const fileSymbolQuery = `
          MATCH (f:File {path: '${filePath}'})-[:DEFINES]->(s)
          RETURN s.name as name, s.label as type, s.startLine as line
          LIMIT 10
        `;
        const fileSymbols = await executeQuery(fileSymbolQuery);
        
        const symbols: SymbolSummary[] = fileSymbols.map((s: any) => ({
          name: s.name,
          type: (s.type || 'function').toLowerCase() as any,
          line: s.line || 1,
        }));
        
        const isEntryPoint = filePath.includes('index.') || 
                            filePath.includes('main.') || 
                            filePath.includes('app.') ||
                            filePath.includes('cli/');
        
        mainFiles.push({
          path: filePath,
          name: path.basename(filePath),
          language: lang,
          lines,
          description: `Contains ${row.symbolCount} symbols`,
          exports: symbols.map(s => s.name).slice(0, 5),
          imports: [],
          symbols,
          isEntryPoint,
          importance: isEntryPoint ? 'critical' : (row.symbolCount > 10 ? 'high' : 'medium'),
        });
      }
    } catch {}
    
    // Parse dependencies
    progress('Parsing dependencies...', 88);
    const dependencies = await parseDependencies(repoPath);
    
    // Parse Docker info
    progress('Analyzing Docker configuration...', 90);
    const docker = await parseDockerInfo(repoPath);
    
    // Parse documentation
    progress('Scanning documentation...', 92);
    const documentation = await parseDocumentation(repoPath);
    
    // Code analysis
    progress('Generating code analysis...', 95);
    const codeAnalysis: CodeAnalysisInfo = {
      entryPoints: [],
      topClusters: [],
      topProcesses: [],
      architectureNotes: [],
    };
    
    // Get top clusters
    try {
      const clusterQuery = `
        MATCH (c:Community)
        RETURN c.name as name, c.heuristicLabel as label, c.symbolCount as count, c.cohesion as cohesion
        ORDER BY c.symbolCount DESC
        LIMIT 10
      `;
      const clusters = await executeQuery(clusterQuery);
      codeAnalysis.topClusters = clusters.map((c: any) => ({
        name: c.label || c.name,
        symbolCount: c.count || 0,
        cohesion: c.cohesion || 0,
        description: `Cluster with ${c.count} symbols`,
        mainSymbols: [],
      }));
    } catch {}
    
    // Get top processes
    try {
      const processQuery = `
        MATCH (p:Process)
        RETURN p.name as name, p.heuristicLabel as label, p.processType as type, p.stepCount as steps
        ORDER BY p.stepCount DESC
        LIMIT 10
      `;
      const processes = await executeQuery(processQuery);
      codeAnalysis.topProcesses = processes.map((p: any) => ({
        name: p.label || p.name,
        type: p.type || 'unknown',
        steps: p.steps || 0,
        description: `${p.type} flow with ${p.steps} steps`,
        entryPoint: '',
      }));
    } catch {}
    
    await closeKuzu();
    
    // Build report
    progress('Building report...', 98);
    const timestamp = new Date().toISOString();
    
    const report: RepoReport = {
      metadata: {
        repoUrl,
        repoName: repo,
        owner,
        branch,
        commit,
        analyzedAt: timestamp,
        gitnexusVersion: '1.2.9',
      },
      overview: {
        description: documentation.readmeContent?.split('\n')[0]?.replace(/^#\s*/, '') || `${owner}/${repo}`,
        totalFiles: pipelineResult.fileContents.size,
        totalLines,
        totalSymbols: stats.nodes,
        totalRelationships: stats.edges,
        communities: pipelineResult.communityResult?.stats.totalCommunities || 0,
        executionFlows: pipelineResult.processResult?.stats.totalProcesses || 0,
        primaryLanguage,
        license: documentation.licenseName,
      },
      languages,
      structure: {
        tree,
        topLevelDirs,
        maxDepth: 3,
      },
      mainFiles,
      dependencies,
      docker,
      documentation,
      codeAnalysis,
      generatedAt: timestamp,
    };
    
    // Generate markdown
    const markdown = generateMarkdown(report, includeCode);
    
    // Save report
    const dateStr = timestamp.replace(/[:.]/g, '-').slice(0, 19);
    const outputFileName = `${owner}-${repo}-${dateStr}.md`;
    const outputPath = path.join(reportsDir, outputFileName);
    
    await fs.writeFile(outputPath, markdown, 'utf-8');
    
    // Cleanup temp directory
    if (cleanup) {
      progress('Cleaning up...', 99);
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {}
    }
    
    progress('Report complete!', 100);
    
    return { report, markdown, outputPath };
    
  } catch (error) {
    // Cleanup on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
    throw error;
  }
};

const generateMarkdown = (report: RepoReport, includeCode: boolean): string => {
  const lines: string[] = [];
  const { metadata, overview, languages, structure, mainFiles, dependencies, docker, documentation, codeAnalysis } = report;
  
  // Header
  lines.push(`# Repository Analysis Report: ${metadata.owner}/${metadata.repoName}`);
  lines.push('');
  lines.push(`> Generated by GitNexus v${metadata.gitnexusVersion} on ${new Date(metadata.analyzedAt).toLocaleString()}`);
  lines.push('');
  
  // Table of Contents
  lines.push('## Table of Contents');
  lines.push('');
  lines.push('- [Overview](#overview)');
  lines.push('- [Languages](#languages)');
  lines.push('- [Directory Structure](#directory-structure)');
  lines.push('- [Main Files](#main-files)');
  lines.push('- [Dependencies](#dependencies)');
  if (docker) lines.push('- [Docker Configuration](#docker-configuration)');
  lines.push('- [Documentation](#documentation)');
  lines.push('- [Code Analysis](#code-analysis)');
  lines.push('- [Metadata](#metadata)');
  lines.push('');
  
  // Overview
  lines.push('---');
  lines.push('');
  lines.push('## Overview');
  lines.push('');
  lines.push(`**Repository:** [${metadata.owner}/${metadata.repoName}](${metadata.repoUrl})`);
  lines.push('');
  lines.push(`**Description:** ${overview.description}`);
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Primary Language | ${overview.primaryLanguage} |`);
  lines.push(`| Total Files | ${overview.totalFiles.toLocaleString()} |`);
  lines.push(`| Total Lines | ${overview.totalLines.toLocaleString()} |`);
  lines.push(`| Symbols (Functions/Classes) | ${overview.totalSymbols.toLocaleString()} |`);
  lines.push(`| Relationships | ${overview.totalRelationships.toLocaleString()} |`);
  lines.push(`| Code Communities | ${overview.communities} |`);
  lines.push(`| Execution Flows | ${overview.executionFlows} |`);
  lines.push(`| License | ${overview.license || 'Not specified'} |`);
  lines.push('');
  
  // Languages
  lines.push('---');
  lines.push('');
  lines.push('## Languages');
  lines.push('');
  lines.push('| Language | Files | Lines | Percentage | Extensions |');
  lines.push('|----------|-------|-------|------------|------------|');
  for (const lang of languages.slice(0, 15)) {
    lines.push(`| ${lang.language} | ${lang.files} | ${lang.lines.toLocaleString()} | ${lang.percentage}% | ${lang.extensions.join(', ')} |`);
  }
  lines.push('');
  
  // Directory Structure
  lines.push('---');
  lines.push('');
  lines.push('## Directory Structure');
  lines.push('');
  lines.push('```');
  lines.push(structure.tree);
  lines.push('```');
  lines.push('');
  
  if (structure.topLevelDirs.length > 0) {
    lines.push('### Top-Level Directories');
    lines.push('');
    lines.push('| Directory | Files |');
    lines.push('|-----------|-------|');
    for (const dir of structure.topLevelDirs.slice(0, 10)) {
      lines.push(`| \`${dir.name}/\` | ${dir.fileCount} |`);
    }
    lines.push('');
  }
  
  // Main Files
  lines.push('---');
  lines.push('');
  lines.push('## Main Files');
  lines.push('');
  lines.push('The following files are identified as key components of the codebase:');
  lines.push('');
  
  for (const file of mainFiles.slice(0, 15)) {
    const badge = file.isEntryPoint ? ' 🚀' : '';
    const importance = file.importance === 'critical' ? '⭐⭐⭐' : 
                       file.importance === 'high' ? '⭐⭐' : '⭐';
    
    lines.push(`### ${file.name}${badge}`);
    lines.push('');
    lines.push(`- **Path:** \`${file.path}\``);
    lines.push(`- **Language:** ${file.language}`);
    lines.push(`- **Lines:** ${file.lines.toLocaleString()}`);
    lines.push(`- **Importance:** ${importance}`);
    
    if (file.symbols.length > 0) {
      lines.push(`- **Key Symbols:**`);
      for (const sym of file.symbols.slice(0, 5)) {
        lines.push(`  - \`${sym.name}\` (${sym.type}, line ${sym.line})`);
      }
    }
    lines.push('');
  }
  
  // Dependencies
  lines.push('---');
  lines.push('');
  lines.push('## Dependencies');
  lines.push('');
  
  if (dependencies.packageManager) {
    lines.push(`**Package Manager:** ${dependencies.packageManager}`);
    lines.push('');
    lines.push(`**Total Dependencies:** ${dependencies.totalDependencies}`);
    lines.push('');
    
    if (dependencies.dependencies.length > 0) {
      lines.push('### Runtime Dependencies');
      lines.push('');
      lines.push('| Package | Version |');
      lines.push('|---------|---------|');
      for (const dep of dependencies.dependencies.slice(0, 20)) {
        lines.push(`| ${dep.name} | ${dep.version} |`);
      }
      if (dependencies.dependencies.length > 20) {
        lines.push(`| ... | *${dependencies.dependencies.length - 20} more* |`);
      }
      lines.push('');
    }
    
    if (dependencies.devDependencies.length > 0) {
      lines.push('### Dev Dependencies');
      lines.push('');
      lines.push('| Package | Version |');
      lines.push('|---------|---------|');
      for (const dep of dependencies.devDependencies.slice(0, 15)) {
        lines.push(`| ${dep.name} | ${dep.version} |`);
      }
      if (dependencies.devDependencies.length > 15) {
        lines.push(`| ... | *${dependencies.devDependencies.length - 15} more* |`);
      }
      lines.push('');
    }
  } else {
    lines.push('No package manager detected.');
    lines.push('');
  }
  
  // Docker
  if (docker) {
    lines.push('---');
    lines.push('');
    lines.push('## Docker Configuration');
    lines.push('');
    
    lines.push(`- **Has Dockerfile:** ${docker.hasDockerfile ? 'Yes' : 'No'}`);
    lines.push(`- **Has Docker Compose:** ${docker.hasDockerCompose ? 'Yes' : 'No'}`);
    lines.push('');
    
    if (docker.dockerfiles.length > 0) {
      lines.push('### Dockerfiles');
      lines.push('');
      for (const df of docker.dockerfiles) {
        lines.push(`#### ${df.path}`);
        lines.push('');
        lines.push(`- **Base Image:** \`${df.baseImage}\``);
        lines.push(`- **Stages:** ${df.stages}`);
        if (df.exposedPorts.length > 0) {
          lines.push(`- **Exposed Ports:** ${df.exposedPorts.join(', ')}`);
        }
        lines.push('');
      }
    }
    
    if (docker.services.length > 0) {
      lines.push('### Docker Compose Services');
      lines.push('');
      lines.push('| Service |');
      lines.push('|---------|');
      for (const svc of docker.services) {
        lines.push(`| ${svc.name} |`);
      }
      lines.push('');
    }
    
    if (docker.baseImages.length > 0) {
      lines.push('### Base Images Used');
      lines.push('');
      for (const img of docker.baseImages) {
        lines.push(`- \`${img}\``);
      }
      lines.push('');
    }
  }
  
  // Documentation
  lines.push('---');
  lines.push('');
  lines.push('## Documentation');
  lines.push('');
  lines.push('| Document | Status |');
  lines.push('|----------|--------|');
  lines.push(`| README | ${documentation.hasReadme ? '✅ Yes' : '❌ No'} |`);
  lines.push(`| CONTRIBUTING | ${documentation.hasContributing ? '✅ Yes' : '❌ No'} |`);
  lines.push(`| CHANGELOG | ${documentation.hasChangelog ? '✅ Yes' : '❌ No'} |`);
  lines.push(`| LICENSE | ${documentation.hasLicense ? `✅ ${documentation.licenseName || 'Yes'}` : '❌ No'} |`);
  lines.push('');
  
  if (documentation.additionalDocs.length > 0) {
    lines.push('### Additional Documentation');
    lines.push('');
    for (const doc of documentation.additionalDocs) {
      lines.push(`- \`docs/${doc}\``);
    }
    lines.push('');
  }
  
  if (documentation.readmeContent) {
    lines.push('### README Preview');
    lines.push('');
    lines.push('<details>');
    lines.push('<summary>Click to expand README content</summary>');
    lines.push('');
    lines.push('```markdown');
    lines.push(documentation.readmeContent.slice(0, 3000));
    if (documentation.readmeContent.length > 3000) {
      lines.push('\n... (truncated)');
    }
    lines.push('```');
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }
  
  // Code Analysis
  lines.push('---');
  lines.push('');
  lines.push('## Code Analysis');
  lines.push('');
  
  if (codeAnalysis.topClusters.length > 0) {
    lines.push('### Code Communities (Clusters)');
    lines.push('');
    lines.push('Functional areas identified by community detection:');
    lines.push('');
    lines.push('| Cluster | Symbols | Cohesion |');
    lines.push('|---------|---------|----------|');
    for (const cluster of codeAnalysis.topClusters) {
      const cohesion = typeof cluster.cohesion === 'number' ? cluster.cohesion.toFixed(2) : 'N/A';
      lines.push(`| ${cluster.name} | ${cluster.symbolCount} | ${cohesion} |`);
    }
    lines.push('');
  }
  
  if (codeAnalysis.topProcesses.length > 0) {
    lines.push('### Execution Flows');
    lines.push('');
    lines.push('Key execution paths through the codebase:');
    lines.push('');
    lines.push('| Flow | Type | Steps |');
    lines.push('|------|------|-------|');
    for (const proc of codeAnalysis.topProcesses) {
      lines.push(`| ${proc.name} | ${proc.type} | ${proc.steps} |`);
    }
    lines.push('');
  }
  
  // Metadata
  lines.push('---');
  lines.push('');
  lines.push('## Metadata');
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push(`| Repository URL | ${metadata.repoUrl} |`);
  lines.push(`| Branch | ${metadata.branch} |`);
  lines.push(`| Commit | ${metadata.commit} |`);
  lines.push(`| Analyzed At | ${new Date(metadata.analyzedAt).toLocaleString()} |`);
  lines.push(`| GitNexus Version | ${metadata.gitnexusVersion} |`);
  lines.push('');
  
  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*This report was automatically generated by [GitNexus](https://github.com/abhigyanpatwari/GitNexus).*');
  lines.push('');
  
  return lines.join('\n');
};

export default generateReport;
