export interface RepoReport {
  metadata: ReportMetadata;
  overview: RepoOverview;
  languages: LanguageBreakdown[];
  structure: DirectoryStructure;
  mainFiles: MainFileInfo[];
  dependencies: DependencyInfo;
  docker: DockerInfo | null;
  documentation: DocumentationInfo;
  codeAnalysis: CodeAnalysisInfo;
  generatedAt: string;
}

export interface ReportMetadata {
  repoUrl: string;
  repoName: string;
  owner: string;
  branch: string;
  commit: string;
  analyzedAt: string;
  gitnexusVersion: string;
}

export interface RepoOverview {
  description: string;
  totalFiles: number;
  totalLines: number;
  totalSymbols: number;
  totalRelationships: number;
  communities: number;
  executionFlows: number;
  primaryLanguage: string;
  license: string | null;
}

export interface LanguageBreakdown {
  language: string;
  files: number;
  lines: number;
  percentage: number;
  extensions: string[];
}

export interface DirectoryStructure {
  tree: string;
  topLevelDirs: DirectoryInfo[];
  maxDepth: number;
}

export interface DirectoryInfo {
  name: string;
  path: string;
  fileCount: number;
  description: string;
}

export interface MainFileInfo {
  path: string;
  name: string;
  language: string;
  lines: number;
  description: string;
  exports: string[];
  imports: string[];
  symbols: SymbolSummary[];
  isEntryPoint: boolean;
  importance: 'critical' | 'high' | 'medium' | 'low';
}

export interface SymbolSummary {
  name: string;
  type: 'function' | 'class' | 'interface' | 'method' | 'variable';
  line: number;
  description?: string;
}

export interface DependencyInfo {
  packageManager: string | null;
  dependencies: DependencyItem[];
  devDependencies: DependencyItem[];
  totalDependencies: number;
  outdatedCount: number;
  securityIssues: number;
}

export interface DependencyItem {
  name: string;
  version: string;
  type: 'runtime' | 'dev' | 'peer' | 'optional';
  description?: string;
}

export interface DockerInfo {
  hasDockerfile: boolean;
  hasDockerCompose: boolean;
  dockerfiles: DockerfileInfo[];
  services: DockerServiceInfo[];
  baseImages: string[];
}

export interface DockerfileInfo {
  path: string;
  baseImage: string;
  stages: number;
  exposedPorts: number[];
  commands: string[];
}

export interface DockerServiceInfo {
  name: string;
  image: string;
  ports: string[];
  volumes: string[];
  depends_on: string[];
}

export interface DocumentationInfo {
  hasReadme: boolean;
  readmePath: string | null;
  readmeContent: string | null;
  hasContributing: boolean;
  hasChangelog: boolean;
  hasLicense: boolean;
  licenseName: string | null;
  additionalDocs: string[];
}

export interface CodeAnalysisInfo {
  entryPoints: EntryPointInfo[];
  topClusters: ClusterInfo[];
  topProcesses: ProcessInfo[];
  architectureNotes: string[];
}

export interface EntryPointInfo {
  name: string;
  path: string;
  type: string;
  description: string;
}

export interface ClusterInfo {
  name: string;
  symbolCount: number;
  cohesion: number;
  description: string;
  mainSymbols: string[];
}

export interface ProcessInfo {
  name: string;
  type: string;
  steps: number;
  description: string;
  entryPoint: string;
}

export interface ReportGeneratorOptions {
  repoUrl: string;
  outputDir?: string;
  includeCode?: boolean;
  maxFileSize?: number;
  token?: string;
  cleanup?: boolean;
}
