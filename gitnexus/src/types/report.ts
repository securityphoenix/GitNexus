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
  // Enhanced security/triage sections
  securityAnalysis: SecurityAnalysisInfo;
  dockerDeepDive: DockerDeepDiveInfo | null;
  ownership: OwnershipInfo;
  callGraph: CallGraphInfo;
  vulnerabilityContext: VulnerabilityContextInfo;
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

// ============================================================================
// SECURITY & TRIAGE ANALYSIS TYPES
// ============================================================================

/**
 * Security-focused analysis of the repository
 */
export interface SecurityAnalysisInfo {
  sensitiveFiles: SensitiveFileInfo[];
  secretPatterns: SecretPatternMatch[];
  securityHotspots: SecurityHotspot[];
  todoFixmeComments: CodeComment[];
  errorHandlingPatterns: ErrorHandlingPattern[];
  apiEndpoints: ApiEndpointInfo[];
  authPatterns: AuthPatternInfo[];
}

export interface SensitiveFileInfo {
  path: string;
  type: 'credentials' | 'keys' | 'secrets' | 'config' | 'auth' | 'crypto' | 'database';
  risk: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  inGitignore: boolean;
  inDockerignore: boolean;
}

export interface SecretPatternMatch {
  path: string;
  line: number;
  pattern: string;
  type: 'api_key' | 'password' | 'token' | 'private_key' | 'connection_string' | 'other';
  masked: string;
  confidence: number;
}

export interface SecurityHotspot {
  path: string;
  line: number;
  symbol: string;
  type: 'sql_injection' | 'xss' | 'path_traversal' | 'command_injection' | 'deserialization' | 'crypto' | 'auth' | 'other';
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface CodeComment {
  path: string;
  line: number;
  type: 'TODO' | 'FIXME' | 'HACK' | 'XXX' | 'BUG' | 'SECURITY' | 'DEPRECATED';
  content: string;
  author?: string;
}

export interface ErrorHandlingPattern {
  path: string;
  line: number;
  type: 'try_catch' | 'error_callback' | 'promise_catch' | 'throw' | 'custom_error';
  errorType?: string;
  isLogged: boolean;
  isRethrown: boolean;
}

export interface ApiEndpointInfo {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  route: string;
  handler: string;
  file: string;
  line: number;
  hasAuth: boolean;
  hasValidation: boolean;
  parameters: string[];
}

export interface AuthPatternInfo {
  path: string;
  type: 'jwt' | 'oauth' | 'session' | 'basic' | 'api_key' | 'custom';
  implementation: string;
  line: number;
  dependencies: string[];
}

// ============================================================================
// DOCKER DEEP DIVE TYPES
// ============================================================================

/**
 * Comprehensive Docker analysis for vulnerability triage
 */
export interface DockerDeepDiveInfo {
  dockerfiles: DockerfileDeepInfo[];
  composeFiles: ComposeFileInfo[];
  containerFileMapping: ContainerFileMapping[];
  layerAnalysis: LayerAnalysisInfo[];
  imageLineage: ImageLineageInfo[];
  networkConfig: DockerNetworkInfo[];
  volumeMounts: VolumeMountInfo[];
  securityConfig: DockerSecurityConfig;
}

export interface DockerfileDeepInfo {
  path: string;
  content: string;
  baseImage: BaseImageInfo;
  stages: DockerStageInfo[];
  layers: DockerLayerInfo[];
  instructions: DockerInstructionInfo[];
  buildArgs: BuildArgInfo[];
  envVars: EnvVarInfo[];
  exposedPorts: PortInfo[];
  healthcheck: HealthcheckInfo | null;
  user: string | null;
  workdir: string;
  entrypoint: string[];
  cmd: string[];
  labels: Record<string, string>;
  copiedFiles: CopiedFileInfo[];
  installedPackages: InstalledPackageInfo[];
}

export interface BaseImageInfo {
  fullName: string;
  registry: string;
  repository: string;
  tag: string;
  digest?: string;
  os?: string;
  arch?: string;
  vulnerabilityCount?: number;
  lastUpdated?: string;
}

export interface DockerStageInfo {
  name: string;
  index: number;
  baseImage: string;
  fromLine: number;
  toLine: number;
  isFinal: boolean;
  layerCount: number;
}

export interface DockerLayerInfo {
  index: number;
  instruction: string;
  command: string;
  size?: string;
  createdBy: string;
  filesAdded: string[];
  filesModified: string[];
  packagesInstalled: string[];
}

export interface DockerInstructionInfo {
  line: number;
  instruction: 'FROM' | 'RUN' | 'COPY' | 'ADD' | 'ENV' | 'ARG' | 'EXPOSE' | 'WORKDIR' | 'USER' | 'CMD' | 'ENTRYPOINT' | 'HEALTHCHECK' | 'LABEL' | 'VOLUME' | 'SHELL' | 'STOPSIGNAL' | 'ONBUILD';
  arguments: string;
  raw: string;
  securityImplications?: string;
}

export interface BuildArgInfo {
  name: string;
  defaultValue?: string;
  usedInLayers: number[];
  isSensitive: boolean;
}

export interface EnvVarInfo {
  name: string;
  value: string;
  line: number;
  isSensitive: boolean;
  usedInFiles: string[];
}

export interface PortInfo {
  port: number;
  protocol: 'tcp' | 'udp';
  line: number;
  service?: string;
}

export interface HealthcheckInfo {
  test: string[];
  interval?: string;
  timeout?: string;
  retries?: number;
  startPeriod?: string;
}

export interface CopiedFileInfo {
  source: string;
  destination: string;
  line: number;
  fromStage?: string;
  chown?: string;
  chmod?: string;
  isDirectory: boolean;
  repoFiles: string[];
}

export interface InstalledPackageInfo {
  name: string;
  version?: string;
  manager: 'apt' | 'apk' | 'yum' | 'dnf' | 'pip' | 'npm' | 'gem' | 'cargo' | 'go' | 'other';
  line: number;
  layer: number;
}

export interface ComposeFileInfo {
  path: string;
  version: string;
  services: ComposeServiceInfo[];
  networks: ComposeNetworkInfo[];
  volumes: ComposeVolumeInfo[];
  secrets: ComposeSecretInfo[];
  configs: ComposeConfigInfo[];
}

export interface ComposeServiceInfo {
  name: string;
  image?: string;
  build?: ComposeBuildInfo;
  ports: PortMappingInfo[];
  volumes: ServiceVolumeInfo[];
  environment: Record<string, string>;
  envFile: string[];
  dependsOn: string[];
  networks: string[];
  command?: string;
  entrypoint?: string;
  healthcheck?: HealthcheckInfo;
  restart: string;
  user?: string;
  privileged: boolean;
  capAdd: string[];
  capDrop: string[];
  securityOpt: string[];
  readOnly: boolean;
  tmpfs: string[];
  labels: Record<string, string>;
}

export interface ComposeBuildInfo {
  context: string;
  dockerfile: string;
  args: Record<string, string>;
  target?: string;
}

export interface PortMappingInfo {
  hostPort: string;
  containerPort: string;
  protocol: string;
  hostIp?: string;
}

export interface ServiceVolumeInfo {
  source: string;
  target: string;
  type: 'bind' | 'volume' | 'tmpfs';
  readOnly: boolean;
}

export interface ComposeNetworkInfo {
  name: string;
  driver: string;
  external: boolean;
  internal: boolean;
  ipam?: any;
}

export interface ComposeVolumeInfo {
  name: string;
  driver: string;
  external: boolean;
  labels: Record<string, string>;
}

export interface ComposeSecretInfo {
  name: string;
  file?: string;
  external: boolean;
}

export interface ComposeConfigInfo {
  name: string;
  file?: string;
  external: boolean;
}

/**
 * Maps which repo files end up in which container and layer
 */
export interface ContainerFileMapping {
  repoFile: string;
  containers: ContainerDestination[];
}

export interface ContainerDestination {
  service: string;
  dockerfile: string;
  containerPath: string;
  layer: number;
  instruction: string;
  instructionLine: number;
}

export interface LayerAnalysisInfo {
  dockerfile: string;
  totalLayers: number;
  layers: LayerDetail[];
  optimizationSuggestions: string[];
}

export interface LayerDetail {
  index: number;
  instruction: string;
  size?: string;
  cacheHit?: boolean;
  filesFromRepo: string[];
  packagesAdded: string[];
  securityNotes: string[];
}

export interface ImageLineageInfo {
  dockerfile: string;
  chain: ImageInChain[];
}

export interface ImageInChain {
  image: string;
  tag: string;
  digest?: string;
  os?: string;
  arch?: string;
  size?: string;
  created?: string;
  vulnerabilities?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface DockerNetworkInfo {
  name: string;
  services: string[];
  driver: string;
  isExternal: boolean;
  exposedToHost: boolean;
}

export interface VolumeMountInfo {
  name: string;
  type: 'bind' | 'volume' | 'tmpfs';
  source: string;
  services: VolumeMountService[];
  containsSensitiveData: boolean;
  isReadOnly: boolean;
}

export interface VolumeMountService {
  service: string;
  mountPath: string;
  readOnly: boolean;
}

export interface DockerSecurityConfig {
  privilegedContainers: string[];
  rootContainers: string[];
  capabilitiesAdded: CapabilityInfo[];
  hostNetworkServices: string[];
  hostPidServices: string[];
  sensitiveVolumeMounts: SensitiveVolumeMount[];
  missingSecurityFeatures: MissingSecurityFeature[];
}

export interface CapabilityInfo {
  service: string;
  capability: string;
  risk: string;
}

export interface SensitiveVolumeMount {
  service: string;
  hostPath: string;
  containerPath: string;
  risk: string;
}

export interface MissingSecurityFeature {
  service: string;
  feature: 'non-root-user' | 'read-only-rootfs' | 'no-new-privileges' | 'seccomp' | 'apparmor' | 'healthcheck' | 'resource-limits';
  recommendation: string;
}

// ============================================================================
// OWNERSHIP & BLAME TYPES
// ============================================================================

/**
 * Git blame and ownership analysis
 */
export interface OwnershipInfo {
  contributors: ContributorInfo[];
  fileOwnership: FileOwnershipInfo[];
  hotspots: ChangeHotspot[];
  recentChanges: RecentChangeInfo[];
  codeAge: CodeAgeInfo;
}

export interface ContributorInfo {
  name: string;
  email: string;
  commits: number;
  linesAdded: number;
  linesRemoved: number;
  filesModified: number;
  firstCommit: string;
  lastCommit: string;
  primaryAreas: string[];
  isActive: boolean;
}

export interface FileOwnershipInfo {
  path: string;
  primaryOwner: string;
  contributors: FileContributor[];
  totalCommits: number;
  lastModified: string;
  lastModifiedBy: string;
  linesOfCode: number;
  ownershipDistribution: OwnershipSegment[];
}

export interface FileContributor {
  name: string;
  email: string;
  commits: number;
  linesOwned: number;
  percentage: number;
  lastContribution: string;
}

export interface OwnershipSegment {
  startLine: number;
  endLine: number;
  author: string;
  email: string;
  date: string;
  commitHash: string;
  commitMessage: string;
}

export interface ChangeHotspot {
  path: string;
  changeFrequency: number;
  uniqueContributors: number;
  recentCommits: number;
  bugFixCommits: number;
  churnRate: number;
  riskScore: number;
  lastChange: string;
}

export interface RecentChangeInfo {
  commitHash: string;
  author: string;
  email: string;
  date: string;
  message: string;
  filesChanged: string[];
  additions: number;
  deletions: number;
  isMerge: boolean;
  isBugFix: boolean;
  isSecurityRelated: boolean;
}

export interface CodeAgeInfo {
  averageAge: number;
  oldestFile: { path: string; date: string };
  newestFile: { path: string; date: string };
  ageDistribution: AgeDistributionBucket[];
  staleFiles: string[];
}

export interface AgeDistributionBucket {
  range: string;
  fileCount: number;
  percentage: number;
}

// ============================================================================
// CALL GRAPH TYPES
// ============================================================================

/**
 * Call graph for vulnerability reachability analysis
 */
export interface CallGraphInfo {
  nodes: CallGraphNode[];
  edges: CallGraphEdge[];
  entryPoints: CallGraphEntryPoint[];
  criticalPaths: CriticalPath[];
  dependencyUsage: DependencyUsageInfo[];
  unreachableCode: UnreachableCodeInfo[];
}

export interface CallGraphNode {
  id: string;
  name: string;
  type: 'function' | 'method' | 'class' | 'module' | 'external';
  file: string;
  line: number;
  signature?: string;
  returnType?: string;
  parameters?: ParameterInfo[];
  isExported: boolean;
  isEntryPoint: boolean;
  isExternal: boolean;
  package?: string;
  callerCount: number;
  calleeCount: number;
}

export interface ParameterInfo {
  name: string;
  type?: string;
  isOptional: boolean;
  defaultValue?: string;
}

export interface CallGraphEdge {
  from: string;
  to: string;
  type: 'call' | 'import' | 'extends' | 'implements' | 'uses';
  file: string;
  line: number;
  confidence: number;
  isDynamic: boolean;
  isConditional: boolean;
}

export interface CallGraphEntryPoint {
  nodeId: string;
  type: 'http_endpoint' | 'cli_command' | 'event_handler' | 'cron_job' | 'main' | 'export' | 'callback';
  route?: string;
  method?: string;
  description: string;
  reachableNodes: number;
}

export interface CriticalPath {
  name: string;
  description: string;
  nodes: string[];
  entryPoint: string;
  exitPoint: string;
  touchesSensitiveData: boolean;
  touchesExternalService: boolean;
  hasAuthCheck: boolean;
  hasValidation: boolean;
}

export interface DependencyUsageInfo {
  package: string;
  version: string;
  importedBy: DependencyImport[];
  functionsUsed: string[];
  isDirectDependency: boolean;
  isDevDependency: boolean;
  usageCount: number;
  reachableFromEntryPoint: boolean;
}

export interface DependencyImport {
  file: string;
  line: number;
  importedSymbols: string[];
  isTypeOnly: boolean;
}

export interface UnreachableCodeInfo {
  file: string;
  startLine: number;
  endLine: number;
  symbol: string;
  type: string;
  reason: string;
}

// ============================================================================
// VULNERABILITY CONTEXT TYPES
// ============================================================================

/**
 * Context for vulnerability triage and applicability
 */
export interface VulnerabilityContextInfo {
  dependencyVulnerabilities: DependencyVulnerabilityContext[];
  codeVulnerabilities: CodeVulnerabilityContext[];
  containerVulnerabilities: ContainerVulnerabilityContext[];
  applicabilityRules: ApplicabilityRule[];
  mitigatingFactors: MitigatingFactor[];
  attackSurface: AttackSurfaceInfo;
}

export interface DependencyVulnerabilityContext {
  package: string;
  version: string;
  vulnerableVersions: string;
  fixedVersion?: string;
  cveIds: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  cvssScore?: number;
  description: string;
  // Applicability analysis
  isReachable: boolean;
  reachabilityPath: string[];
  vulnerableFunctions: string[];
  usedVulnerableFunctions: string[];
  isDevDependency: boolean;
  isTestOnly: boolean;
  inProductionContainer: boolean;
  containerServices: string[];
  mitigations: string[];
  applicabilityScore: number;
  applicabilityReason: string;
}

export interface CodeVulnerabilityContext {
  type: string;
  file: string;
  line: number;
  symbol: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cweId?: string;
  // Context
  isReachableFromEntryPoint: boolean;
  entryPoints: string[];
  callPath: string[];
  hasInputValidation: boolean;
  hasSanitization: boolean;
  isInAuthenticatedPath: boolean;
  owner: string;
  lastModified: string;
  inContainer: boolean;
  containerServices: string[];
}

export interface ContainerVulnerabilityContext {
  image: string;
  layer: number;
  package: string;
  version: string;
  cveIds: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  // Context
  isBaseImage: boolean;
  isInFinalStage: boolean;
  affectedServices: string[];
  affectedFiles: string[];
  canBeUpdated: boolean;
  updatePath?: string;
  isOsPackage: boolean;
  isApplicationPackage: boolean;
}

export interface ApplicabilityRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  appliesTo: 'dependency' | 'code' | 'container' | 'all';
  reduces: boolean;
  reason: string;
  matchedVulnerabilities: string[];
}

export interface MitigatingFactor {
  type: 'network_isolation' | 'auth_required' | 'input_validation' | 'waf' | 'not_reachable' | 'dev_only' | 'test_only' | 'not_in_container' | 'read_only_fs' | 'non_root' | 'other';
  description: string;
  appliesTo: string[];
  confidenceReduction: number;
}

export interface AttackSurfaceInfo {
  exposedPorts: ExposedPortInfo[];
  publicEndpoints: PublicEndpointInfo[];
  externalConnections: ExternalConnectionInfo[];
  dataFlows: DataFlowInfo[];
  trustBoundaries: TrustBoundaryInfo[];
}

export interface ExposedPortInfo {
  port: number;
  protocol: string;
  service: string;
  container?: string;
  isPublic: boolean;
  hasAuth: boolean;
  hasTls: boolean;
}

export interface PublicEndpointInfo {
  route: string;
  method: string;
  handler: string;
  file: string;
  hasAuth: boolean;
  hasRateLimit: boolean;
  hasValidation: boolean;
  acceptsUserInput: boolean;
  inputTypes: string[];
}

export interface ExternalConnectionInfo {
  type: 'database' | 'api' | 'queue' | 'cache' | 'storage' | 'other';
  destination: string;
  file: string;
  line: number;
  hasTls: boolean;
  hasAuth: boolean;
  credentialSource: string;
}

export interface DataFlowInfo {
  name: string;
  source: string;
  sink: string;
  path: string[];
  containsSensitiveData: boolean;
  dataTypes: string[];
  hasEncryption: boolean;
  crossesTrustBoundary: boolean;
}

export interface TrustBoundaryInfo {
  name: string;
  type: 'network' | 'process' | 'container' | 'service' | 'user';
  inside: string[];
  outside: string[];
  crossingPoints: string[];
}
