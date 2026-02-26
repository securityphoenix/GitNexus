import fs from 'fs/promises';
import path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';
import {
  SecurityAnalysisInfo,
  SensitiveFileInfo,
  SecretPatternMatch,
  SecurityHotspot,
  CodeComment,
  ErrorHandlingPattern,
  ApiEndpointInfo,
  AuthPatternInfo,
  DockerDeepDiveInfo,
  DockerfileDeepInfo,
  BaseImageInfo,
  DockerStageInfo,
  DockerLayerInfo,
  DockerInstructionInfo,
  BuildArgInfo,
  EnvVarInfo,
  PortInfo,
  CopiedFileInfo,
  InstalledPackageInfo,
  ComposeFileInfo,
  ComposeServiceInfo,
  ContainerFileMapping,
  ContainerDestination,
  LayerAnalysisInfo,
  DockerSecurityConfig,
  OwnershipInfo,
  ContributorInfo,
  FileOwnershipInfo,
  ChangeHotspot,
  RecentChangeInfo,
  CodeAgeInfo,
  CallGraphInfo,
  CallGraphNode,
  CallGraphEdge,
  CallGraphEntryPoint,
  DependencyUsageInfo,
  VulnerabilityContextInfo,
  AttackSurfaceInfo,
} from '../types/report.js';

// Secret patterns to detect
const SECRET_PATTERNS = [
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi, type: 'api_key' as const },
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]?([^'"\s]{8,})['"]?/gi, type: 'password' as const },
  { pattern: /(?:secret|token)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi, type: 'token' as const },
  { pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g, type: 'private_key' as const },
  { pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]+/gi, type: 'connection_string' as const },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, type: 'token' as const },
  { pattern: /sk-[a-zA-Z0-9]{48}/g, type: 'api_key' as const },
  { pattern: /AKIA[0-9A-Z]{16}/g, type: 'api_key' as const },
];

// Sensitive file patterns
const SENSITIVE_FILE_PATTERNS = [
  { pattern: /\.env($|\.)/, type: 'secrets' as const, risk: 'critical' as const },
  { pattern: /credentials?\./, type: 'credentials' as const, risk: 'critical' as const },
  { pattern: /secrets?\./, type: 'secrets' as const, risk: 'critical' as const },
  { pattern: /\.pem$/, type: 'keys' as const, risk: 'high' as const },
  { pattern: /\.key$/, type: 'keys' as const, risk: 'high' as const },
  { pattern: /id_rsa/, type: 'keys' as const, risk: 'critical' as const },
  { pattern: /\.p12$/, type: 'keys' as const, risk: 'high' as const },
  { pattern: /config\.(json|ya?ml|toml)$/, type: 'config' as const, risk: 'medium' as const },
  { pattern: /auth/, type: 'auth' as const, risk: 'medium' as const },
  { pattern: /crypto/, type: 'crypto' as const, risk: 'medium' as const },
  { pattern: /database|db\./, type: 'database' as const, risk: 'medium' as const },
];

// Comment patterns
const COMMENT_PATTERNS = [
  { pattern: /\/\/\s*(TODO|FIXME|HACK|XXX|BUG|SECURITY|DEPRECATED):?\s*(.+)/gi, type: 'single' },
  { pattern: /#\s*(TODO|FIXME|HACK|XXX|BUG|SECURITY|DEPRECATED):?\s*(.+)/gi, type: 'hash' },
];

/**
 * Analyze security aspects of the repository
 */
export const analyzeSecurityInfo = async (
  repoPath: string,
  fileContents: Map<string, string>
): Promise<SecurityAnalysisInfo> => {
  const sensitiveFiles: SensitiveFileInfo[] = [];
  const secretPatterns: SecretPatternMatch[] = [];
  const securityHotspots: SecurityHotspot[] = [];
  const todoFixmeComments: CodeComment[] = [];
  const errorHandlingPatterns: ErrorHandlingPattern[] = [];
  const apiEndpoints: ApiEndpointInfo[] = [];
  const authPatterns: AuthPatternInfo[] = [];

  // Check for .gitignore and .dockerignore
  let gitignoreContent = '';
  let dockerignoreContent = '';
  try {
    gitignoreContent = await fs.readFile(path.join(repoPath, '.gitignore'), 'utf-8');
  } catch {}
  try {
    dockerignoreContent = await fs.readFile(path.join(repoPath, '.dockerignore'), 'utf-8');
  } catch {}

  const isInGitignore = (filePath: string): boolean => {
    const relativePath = filePath.replace(repoPath, '').replace(/^\//, '');
    return gitignoreContent.split('\n').some(line => {
      const pattern = line.trim();
      if (!pattern || pattern.startsWith('#')) return false;
      return relativePath.includes(pattern) || new RegExp(pattern.replace(/\*/g, '.*')).test(relativePath);
    });
  };

  const isInDockerignore = (filePath: string): boolean => {
    const relativePath = filePath.replace(repoPath, '').replace(/^\//, '');
    return dockerignoreContent.split('\n').some(line => {
      const pattern = line.trim();
      if (!pattern || pattern.startsWith('#')) return false;
      return relativePath.includes(pattern) || new RegExp(pattern.replace(/\*/g, '.*')).test(relativePath);
    });
  };

  for (const [filePath, content] of fileContents) {
    const relativePath = filePath;
    const fileName = path.basename(filePath);

    // Check for sensitive files
    for (const { pattern, type, risk } of SENSITIVE_FILE_PATTERNS) {
      if (pattern.test(fileName) || pattern.test(relativePath)) {
        sensitiveFiles.push({
          path: relativePath,
          type,
          risk,
          reason: `File matches sensitive pattern: ${pattern}`,
          inGitignore: isInGitignore(filePath),
          inDockerignore: isInDockerignore(filePath),
        });
        break;
      }
    }

    // Scan for secrets
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { pattern, type } of SECRET_PATTERNS) {
        pattern.lastIndex = 0;
        const match = pattern.exec(line);
        if (match) {
          secretPatterns.push({
            path: relativePath,
            line: i + 1,
            pattern: pattern.source.slice(0, 30),
            type,
            masked: match[0].slice(0, 10) + '***',
            confidence: 0.8,
          });
        }
      }

      // Check for TODO/FIXME comments
      for (const { pattern } of COMMENT_PATTERNS) {
        pattern.lastIndex = 0;
        const match = pattern.exec(line);
        if (match) {
          todoFixmeComments.push({
            path: relativePath,
            line: i + 1,
            type: match[1].toUpperCase() as any,
            content: match[2].trim(),
          });
        }
      }
    }

    // Detect API endpoints (Express/Fastify/Koa patterns)
    const routePatterns = [
      /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
      /@(Get|Post|Put|Delete|Patch)\s*\(\s*['"`]?([^'"`\)]+)['"`]?\)/gi,
    ];
    for (const routePattern of routePatterns) {
      routePattern.lastIndex = 0;
      let match;
      while ((match = routePattern.exec(content)) !== null) {
        const lineNum = content.slice(0, match.index).split('\n').length;
        apiEndpoints.push({
          path: relativePath,
          method: match[1].toUpperCase() as any,
          route: match[2],
          handler: 'unknown',
          file: relativePath,
          line: lineNum,
          hasAuth: content.includes('auth') || content.includes('jwt') || content.includes('session'),
          hasValidation: content.includes('validate') || content.includes('schema') || content.includes('zod'),
          parameters: [],
        });
      }
    }

    // Detect auth patterns
    if (content.includes('jwt') || content.includes('jsonwebtoken')) {
      authPatterns.push({
        path: relativePath,
        type: 'jwt',
        implementation: 'jsonwebtoken',
        line: 1,
        dependencies: ['jsonwebtoken'],
      });
    }
    if (content.includes('passport')) {
      authPatterns.push({
        path: relativePath,
        type: 'oauth',
        implementation: 'passport',
        line: 1,
        dependencies: ['passport'],
      });
    }
    if (content.includes('express-session') || content.includes('cookie-session')) {
      authPatterns.push({
        path: relativePath,
        type: 'session',
        implementation: 'express-session',
        line: 1,
        dependencies: ['express-session'],
      });
    }

    // Detect error handling patterns
    const tryMatch = content.match(/try\s*\{/g);
    if (tryMatch) {
      errorHandlingPatterns.push({
        path: relativePath,
        line: 1,
        type: 'try_catch',
        isLogged: content.includes('console.error') || content.includes('logger.error'),
        isRethrown: content.includes('throw'),
      });
    }

    // Security hotspots
    const sqlPatterns = /(?:query|execute)\s*\(\s*['"`].*\$\{|\.raw\s*\(/gi;
    if (sqlPatterns.test(content)) {
      securityHotspots.push({
        path: relativePath,
        line: 1,
        symbol: 'SQL query',
        type: 'sql_injection',
        description: 'Potential SQL injection - string interpolation in query',
        severity: 'high',
      });
    }

    const evalPatterns = /\beval\s*\(|new\s+Function\s*\(/gi;
    if (evalPatterns.test(content)) {
      securityHotspots.push({
        path: relativePath,
        line: 1,
        symbol: 'eval/Function',
        type: 'command_injection',
        description: 'Use of eval or Function constructor',
        severity: 'critical',
      });
    }
  }

  return {
    sensitiveFiles,
    secretPatterns,
    securityHotspots,
    todoFixmeComments,
    errorHandlingPatterns,
    apiEndpoints,
    authPatterns,
  };
};

/**
 * Deep analysis of Docker configuration
 */
export const analyzeDockerDeep = async (
  repoPath: string,
  fileContents: Map<string, string>
): Promise<DockerDeepDiveInfo | null> => {
  const dockerfiles: DockerfileDeepInfo[] = [];
  const composeFiles: ComposeFileInfo[] = [];
  const containerFileMapping: ContainerFileMapping[] = [];
  const layerAnalysis: LayerAnalysisInfo[] = [];

  // Find all Dockerfiles
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
    } catch {}
    return files;
  };

  const dockerfilePaths = await findDockerfiles(repoPath);
  
  if (dockerfilePaths.length === 0) {
    // Check for docker-compose only
    const composeNames = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
    let hasCompose = false;
    for (const name of composeNames) {
      try {
        await fs.access(path.join(repoPath, name));
        hasCompose = true;
        break;
      } catch {}
    }
    if (!hasCompose) return null;
  }

  // Parse each Dockerfile
  for (const dfPath of dockerfilePaths) {
    try {
      const content = await fs.readFile(dfPath, 'utf-8');
      const relativePath = path.relative(repoPath, dfPath);
      const parsed = parseDockerfile(content, relativePath, repoPath, fileContents);
      dockerfiles.push(parsed);

      // Build layer analysis
      layerAnalysis.push({
        dockerfile: relativePath,
        totalLayers: parsed.layers.length,
        layers: parsed.layers.map((l, i) => ({
          index: i,
          instruction: l.instruction,
          size: l.size,
          filesFromRepo: l.filesAdded,
          packagesAdded: l.packagesInstalled,
          securityNotes: [],
        })),
        optimizationSuggestions: generateOptimizationSuggestions(parsed),
      });

      // Build container file mapping
      for (const copied of parsed.copiedFiles) {
        for (const repoFile of copied.repoFiles) {
          let mapping = containerFileMapping.find(m => m.repoFile === repoFile);
          if (!mapping) {
            mapping = { repoFile, containers: [] };
            containerFileMapping.push(mapping);
          }
          mapping.containers.push({
            service: path.basename(path.dirname(dfPath)) || 'default',
            dockerfile: relativePath,
            containerPath: copied.destination,
            layer: parsed.copiedFiles.indexOf(copied),
            instruction: 'COPY',
            instructionLine: copied.line,
          });
        }
      }
    } catch {}
  }

  // Parse docker-compose files
  const composeNames = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
  for (const name of composeNames) {
    try {
      const composePath = path.join(repoPath, name);
      const content = await fs.readFile(composePath, 'utf-8');
      const parsed = parseComposeFile(content, name);
      composeFiles.push(parsed);
    } catch {}
  }

  // Build security config
  const securityConfig = buildDockerSecurityConfig(dockerfiles, composeFiles);

  return {
    dockerfiles,
    composeFiles,
    containerFileMapping,
    layerAnalysis,
    imageLineage: [],
    networkConfig: [],
    volumeMounts: [],
    securityConfig,
  };
};

function parseDockerfile(
  content: string,
  relativePath: string,
  repoPath: string,
  fileContents: Map<string, string>
): DockerfileDeepInfo {
  const lines = content.split('\n');
  const instructions: DockerInstructionInfo[] = [];
  const stages: DockerStageInfo[] = [];
  const layers: DockerLayerInfo[] = [];
  const buildArgs: BuildArgInfo[] = [];
  const envVars: EnvVarInfo[] = [];
  const exposedPorts: PortInfo[] = [];
  const copiedFiles: CopiedFileInfo[] = [];
  const installedPackages: InstalledPackageInfo[] = [];

  let currentStage = 0;
  let baseImage: BaseImageInfo = {
    fullName: 'unknown',
    registry: 'docker.io',
    repository: 'unknown',
    tag: 'latest',
  };
  let workdir = '/';
  let user: string | null = null;
  let entrypoint: string[] = [];
  let cmd: string[] = [];
  const labels: Record<string, string> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    const instructionMatch = line.match(/^([A-Z]+)\s+(.*)$/);
    if (!instructionMatch) continue;

    const [, instruction, args] = instructionMatch;
    
    instructions.push({
      line: i + 1,
      instruction: instruction as any,
      arguments: args,
      raw: line,
    });

    switch (instruction) {
      case 'FROM': {
        const fromMatch = args.match(/^([^\s]+)(?:\s+AS\s+(\w+))?/i);
        if (fromMatch) {
          const imageName = fromMatch[1];
          const stageName = fromMatch[2];
          
          // Parse image name
          const imageInfo = parseImageName(imageName);
          if (currentStage === 0) {
            baseImage = imageInfo;
          }

          stages.push({
            name: stageName || `stage${currentStage}`,
            index: currentStage,
            baseImage: imageName,
            fromLine: i + 1,
            toLine: lines.length,
            isFinal: true,
            layerCount: 0,
          });

          if (stages.length > 1) {
            stages[stages.length - 2].toLine = i;
            stages[stages.length - 2].isFinal = false;
          }

          currentStage++;
        }
        break;
      }

      case 'RUN': {
        layers.push({
          index: layers.length,
          instruction: 'RUN',
          command: args,
          createdBy: `RUN ${args.slice(0, 50)}...`,
          filesAdded: [],
          filesModified: [],
          packagesInstalled: [],
        });

        // Detect package installations
        const aptMatch = args.match(/apt-get\s+install\s+(?:-y\s+)?(.+)/);
        if (aptMatch) {
          const packages = aptMatch[1].split(/\s+/).filter(p => !p.startsWith('-') && p.length > 0);
          for (const pkg of packages) {
            installedPackages.push({
              name: pkg.replace(/[=<>].*/, ''),
              manager: 'apt',
              line: i + 1,
              layer: layers.length - 1,
            });
            layers[layers.length - 1].packagesInstalled.push(pkg);
          }
        }

        const apkMatch = args.match(/apk\s+add\s+(?:--no-cache\s+)?(.+)/);
        if (apkMatch) {
          const packages = apkMatch[1].split(/\s+/).filter(p => !p.startsWith('-') && p.length > 0);
          for (const pkg of packages) {
            installedPackages.push({
              name: pkg,
              manager: 'apk',
              line: i + 1,
              layer: layers.length - 1,
            });
            layers[layers.length - 1].packagesInstalled.push(pkg);
          }
        }

        const npmMatch = args.match(/npm\s+(?:install|i|ci)\s+(.+)/);
        if (npmMatch) {
          installedPackages.push({
            name: 'npm dependencies',
            manager: 'npm',
            line: i + 1,
            layer: layers.length - 1,
          });
        }

        const pipMatch = args.match(/pip\s+install\s+(.+)/);
        if (pipMatch) {
          const packages = pipMatch[1].split(/\s+/).filter(p => !p.startsWith('-') && p.length > 0);
          for (const pkg of packages) {
            installedPackages.push({
              name: pkg,
              manager: 'pip',
              line: i + 1,
              layer: layers.length - 1,
            });
          }
        }
        break;
      }

      case 'COPY':
      case 'ADD': {
        const copyMatch = args.match(/(?:--from=(\w+)\s+)?(?:--chown=([^\s]+)\s+)?(?:--chmod=([^\s]+)\s+)?(.+)\s+(.+)/);
        if (copyMatch) {
          const [, fromStage, chown, chmod, source, destination] = copyMatch;
          
          // Find matching repo files
          const repoFiles: string[] = [];
          const sourcePattern = source.replace(/\*/g, '.*');
          for (const [filePath] of fileContents) {
            if (new RegExp(sourcePattern).test(filePath)) {
              repoFiles.push(filePath);
            }
          }

          copiedFiles.push({
            source,
            destination,
            line: i + 1,
            fromStage,
            chown,
            chmod,
            isDirectory: source.endsWith('/') || source.includes('*'),
            repoFiles,
          });

          layers.push({
            index: layers.length,
            instruction: instruction as any,
            command: args,
            createdBy: `${instruction} ${args}`,
            filesAdded: repoFiles,
            filesModified: [],
            packagesInstalled: [],
          });
        }
        break;
      }

      case 'ENV': {
        const envMatch = args.match(/^(\w+)[=\s]+(.*)$/);
        if (envMatch) {
          const isSensitive = /password|secret|key|token|credential/i.test(envMatch[1]);
          envVars.push({
            name: envMatch[1],
            value: envMatch[2].replace(/["']/g, ''),
            line: i + 1,
            isSensitive,
            usedInFiles: [],
          });
        }
        break;
      }

      case 'ARG': {
        const argMatch = args.match(/^(\w+)(?:=(.*))?$/);
        if (argMatch) {
          const isSensitive = /password|secret|key|token|credential/i.test(argMatch[1]);
          buildArgs.push({
            name: argMatch[1],
            defaultValue: argMatch[2],
            usedInLayers: [],
            isSensitive,
          });
        }
        break;
      }

      case 'EXPOSE': {
        const ports = args.split(/\s+/);
        for (const p of ports) {
          const portMatch = p.match(/^(\d+)(?:\/(tcp|udp))?$/);
          if (portMatch) {
            exposedPorts.push({
              port: parseInt(portMatch[1]),
              protocol: (portMatch[2] || 'tcp') as any,
              line: i + 1,
            });
          }
        }
        break;
      }

      case 'WORKDIR':
        workdir = args;
        break;

      case 'USER':
        user = args;
        break;

      case 'ENTRYPOINT':
        try {
          entrypoint = JSON.parse(args);
        } catch {
          entrypoint = [args];
        }
        break;

      case 'CMD':
        try {
          cmd = JSON.parse(args);
        } catch {
          cmd = [args];
        }
        break;

      case 'LABEL': {
        const labelMatch = args.match(/^(\w+)[=\s]+["']?([^"']+)["']?$/);
        if (labelMatch) {
          labels[labelMatch[1]] = labelMatch[2];
        }
        break;
      }
    }
  }

  // Update stage layer counts
  for (const stage of stages) {
    stage.layerCount = layers.filter((_, i) => {
      const layerLine = instructions.find(inst => inst.line === i + 1)?.line || 0;
      return layerLine >= stage.fromLine && layerLine <= stage.toLine;
    }).length;
  }

  return {
    path: relativePath,
    content,
    baseImage,
    stages,
    layers,
    instructions,
    buildArgs,
    envVars,
    exposedPorts,
    healthcheck: null,
    user,
    workdir,
    entrypoint,
    cmd,
    labels,
    copiedFiles,
    installedPackages,
  };
}

function parseImageName(imageName: string): BaseImageInfo {
  let registry = 'docker.io';
  let repository = imageName;
  let tag = 'latest';
  let digest: string | undefined;

  // Check for digest
  if (imageName.includes('@')) {
    const [name, d] = imageName.split('@');
    repository = name;
    digest = d;
  }

  // Check for tag
  if (repository.includes(':')) {
    const [name, t] = repository.split(':');
    repository = name;
    tag = t;
  }

  // Check for registry
  if (repository.includes('/') && repository.split('/')[0].includes('.')) {
    const parts = repository.split('/');
    registry = parts[0];
    repository = parts.slice(1).join('/');
  }

  return {
    fullName: imageName,
    registry,
    repository,
    tag,
    digest,
  };
}

function parseComposeFile(content: string, name: string): ComposeFileInfo {
  const services: ComposeServiceInfo[] = [];
  
  // Simple YAML parsing for services
  const lines = content.split('\n');
  let currentService: string | null = null;
  let inServices = false;
  let indent = 0;

  for (const line of lines) {
    if (line.trim() === 'services:') {
      inServices = true;
      continue;
    }

    if (inServices && line.match(/^  \w/)) {
      const serviceMatch = line.match(/^  (\w[\w-]*):/);
      if (serviceMatch) {
        currentService = serviceMatch[1];
        services.push({
          name: currentService,
          ports: [],
          volumes: [],
          environment: {},
          envFile: [],
          dependsOn: [],
          networks: [],
          restart: 'no',
          privileged: false,
          capAdd: [],
          capDrop: [],
          securityOpt: [],
          readOnly: false,
          tmpfs: [],
          labels: {},
        });
      }
    }

    if (currentService && services.length > 0) {
      const svc = services[services.length - 1];
      
      if (line.includes('image:')) {
        svc.image = line.split('image:')[1].trim();
      }
      if (line.includes('privileged:') && line.includes('true')) {
        svc.privileged = true;
      }
      if (line.includes('read_only:') && line.includes('true')) {
        svc.readOnly = true;
      }
      if (line.includes('user:')) {
        svc.user = line.split('user:')[1].trim().replace(/["']/g, '');
      }
    }
  }

  return {
    path: name,
    version: '3',
    services,
    networks: [],
    volumes: [],
    secrets: [],
    configs: [],
  };
}

function generateOptimizationSuggestions(dockerfile: DockerfileDeepInfo): string[] {
  const suggestions: string[] = [];

  // Check for multiple RUN commands that could be combined
  const runLayers = dockerfile.layers.filter(l => l.instruction === 'RUN');
  if (runLayers.length > 5) {
    suggestions.push('Consider combining multiple RUN commands to reduce layers');
  }

  // Check for apt-get without cleanup
  for (const layer of dockerfile.layers) {
    if (layer.command.includes('apt-get install') && !layer.command.includes('rm -rf /var/lib/apt/lists')) {
      suggestions.push('Add "rm -rf /var/lib/apt/lists/*" after apt-get install to reduce image size');
    }
  }

  // Check for COPY before RUN npm install
  const copyIndex = dockerfile.instructions.findIndex(i => i.instruction === 'COPY' && i.arguments.includes('package'));
  const npmIndex = dockerfile.instructions.findIndex(i => i.instruction === 'RUN' && i.arguments.includes('npm'));
  if (copyIndex > -1 && npmIndex > -1 && copyIndex > npmIndex) {
    suggestions.push('Copy package.json before npm install for better layer caching');
  }

  // Check for non-root user
  if (!dockerfile.user) {
    suggestions.push('Consider running as non-root user for security');
  }

  return suggestions;
}

function buildDockerSecurityConfig(
  dockerfiles: DockerfileDeepInfo[],
  composeFiles: ComposeFileInfo[]
): DockerSecurityConfig {
  const privilegedContainers: string[] = [];
  const rootContainers: string[] = [];
  const capabilitiesAdded: { service: string; capability: string; risk: string }[] = [];
  const hostNetworkServices: string[] = [];
  const hostPidServices: string[] = [];
  const sensitiveVolumeMounts: { service: string; hostPath: string; containerPath: string; risk: string }[] = [];
  const missingSecurityFeatures: { service: string; feature: any; recommendation: string }[] = [];

  for (const compose of composeFiles) {
    for (const service of compose.services) {
      if (service.privileged) {
        privilegedContainers.push(service.name);
      }

      if (!service.user || service.user === 'root' || service.user === '0') {
        rootContainers.push(service.name);
        missingSecurityFeatures.push({
          service: service.name,
          feature: 'non-root-user',
          recommendation: 'Run container as non-root user',
        });
      }

      if (!service.readOnly) {
        missingSecurityFeatures.push({
          service: service.name,
          feature: 'read-only-rootfs',
          recommendation: 'Consider read-only root filesystem',
        });
      }

      for (const cap of service.capAdd) {
        capabilitiesAdded.push({
          service: service.name,
          capability: cap,
          risk: cap === 'SYS_ADMIN' ? 'critical' : 'medium',
        });
      }
    }
  }

  // Check Dockerfiles for root user
  for (const df of dockerfiles) {
    if (!df.user) {
      const serviceName = path.basename(path.dirname(df.path)) || 'default';
      if (!rootContainers.includes(serviceName)) {
        rootContainers.push(serviceName);
      }
    }
  }

  return {
    privilegedContainers,
    rootContainers,
    capabilitiesAdded,
    hostNetworkServices,
    hostPidServices,
    sensitiveVolumeMounts,
    missingSecurityFeatures,
  };
}

/**
 * Analyze git blame and ownership
 */
export const analyzeOwnership = async (
  repoPath: string,
  fileContents: Map<string, string>
): Promise<OwnershipInfo> => {
  const git: SimpleGit = simpleGit(repoPath);
  const contributors: ContributorInfo[] = [];
  const fileOwnership: FileOwnershipInfo[] = [];
  const hotspots: ChangeHotspot[] = [];
  const recentChanges: RecentChangeInfo[] = [];

  try {
    // Get all contributors
    const log = await git.log({ '--all': null, '--format': '%an|%ae|%H|%aI' });
    const contributorMap = new Map<string, ContributorInfo>();

    for (const commit of log.all) {
      const [name, email] = [commit.author_name, commit.author_email];
      const key = email || name;
      
      if (!contributorMap.has(key)) {
        contributorMap.set(key, {
          name,
          email: email || '',
          commits: 0,
          linesAdded: 0,
          linesRemoved: 0,
          filesModified: 0,
          firstCommit: commit.date,
          lastCommit: commit.date,
          primaryAreas: [],
          isActive: false,
        });
      }
      
      const contributor = contributorMap.get(key)!;
      contributor.commits++;
      if (commit.date < contributor.firstCommit) contributor.firstCommit = commit.date;
      if (commit.date > contributor.lastCommit) contributor.lastCommit = commit.date;
    }

    // Check if contributors are active (committed in last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    for (const contributor of contributorMap.values()) {
      contributor.isActive = new Date(contributor.lastCommit) > ninetyDaysAgo;
      contributors.push(contributor);
    }

    // Get recent changes
    const recentLog = await git.log({ maxCount: 50 });
    for (const commit of recentLog.all) {
      const isBugFix = /fix|bug|patch|hotfix/i.test(commit.message);
      const isSecurityRelated = /security|vuln|cve|auth|xss|sql|inject/i.test(commit.message);
      
      recentChanges.push({
        commitHash: commit.hash.slice(0, 7),
        author: commit.author_name,
        email: commit.author_email,
        date: commit.date,
        message: commit.message.split('\n')[0],
        filesChanged: [],
        additions: 0,
        deletions: 0,
        isMerge: commit.message.toLowerCase().includes('merge'),
        isBugFix,
        isSecurityRelated,
      });
    }

    // Analyze file ownership (sample of files to avoid timeout)
    const filesToAnalyze = Array.from(fileContents.keys()).slice(0, 50);
    
    for (const filePath of filesToAnalyze) {
      try {
        const fileLog = await git.log({ file: filePath, maxCount: 100 });
        if (fileLog.all.length === 0) continue;

        const fileContributors = new Map<string, { commits: number; lastDate: string }>();
        
        for (const commit of fileLog.all) {
          const key = commit.author_email || commit.author_name;
          if (!fileContributors.has(key)) {
            fileContributors.set(key, { commits: 0, lastDate: commit.date });
          }
          const fc = fileContributors.get(key)!;
          fc.commits++;
          if (commit.date > fc.lastDate) fc.lastDate = commit.date;
        }

        const sortedContributors = Array.from(fileContributors.entries())
          .sort((a, b) => b[1].commits - a[1].commits);

        const primaryOwner = sortedContributors[0]?.[0] || 'unknown';

        fileOwnership.push({
          path: filePath,
          primaryOwner,
          contributors: sortedContributors.map(([email, data]) => ({
            name: email.split('@')[0],
            email,
            commits: data.commits,
            linesOwned: 0,
            percentage: Math.round((data.commits / fileLog.all.length) * 100),
            lastContribution: data.lastDate,
          })),
          totalCommits: fileLog.all.length,
          lastModified: fileLog.latest?.date || '',
          lastModifiedBy: fileLog.latest?.author_name || '',
          linesOfCode: (fileContents.get(filePath) || '').split('\n').length,
          ownershipDistribution: [],
        });

        // Identify hotspots (files with high change frequency)
        if (fileLog.all.length > 10) {
          const uniqueAuthors = new Set(fileLog.all.map(c => c.author_email));
          const bugFixes = fileLog.all.filter(c => /fix|bug/i.test(c.message)).length;
          
          hotspots.push({
            path: filePath,
            changeFrequency: fileLog.all.length,
            uniqueContributors: uniqueAuthors.size,
            recentCommits: fileLog.all.filter(c => {
              const commitDate = new Date(c.date);
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              return commitDate > thirtyDaysAgo;
            }).length,
            bugFixCommits: bugFixes,
            churnRate: fileLog.all.length / 30,
            riskScore: Math.min(100, fileLog.all.length * 2 + bugFixes * 5),
            lastChange: fileLog.latest?.date || '',
          });
        }
      } catch {}
    }

    // Sort hotspots by risk
    hotspots.sort((a, b) => b.riskScore - a.riskScore);

  } catch (e) {
    // Git operations failed, return empty data
  }

  // Calculate code age
  const codeAge: CodeAgeInfo = {
    averageAge: 0,
    oldestFile: { path: '', date: '' },
    newestFile: { path: '', date: '' },
    ageDistribution: [],
    staleFiles: [],
  };

  if (fileOwnership.length > 0) {
    const sorted = [...fileOwnership].sort((a, b) => 
      new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime()
    );
    
    codeAge.oldestFile = { path: sorted[0].path, date: sorted[0].lastModified };
    codeAge.newestFile = { path: sorted[sorted.length - 1].path, date: sorted[sorted.length - 1].lastModified };
    
    // Find stale files (not modified in 1 year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    codeAge.staleFiles = fileOwnership
      .filter(f => new Date(f.lastModified) < oneYearAgo)
      .map(f => f.path);
  }

  return {
    contributors: contributors.sort((a, b) => b.commits - a.commits),
    fileOwnership,
    hotspots: hotspots.slice(0, 20),
    recentChanges,
    codeAge,
  };
};

/**
 * Build call graph information from the knowledge graph
 */
export const buildCallGraphInfo = async (
  fileContents: Map<string, string>,
  graphNodes: any[],
  graphEdges: any[]
): Promise<CallGraphInfo> => {
  const nodes: CallGraphNode[] = [];
  const edges: CallGraphEdge[] = [];
  const entryPoints: CallGraphEntryPoint[] = [];
  const dependencyUsage: DependencyUsageInfo[] = [];

  // Convert graph nodes to call graph nodes
  for (const node of graphNodes) {
    if (['Function', 'Method', 'Class'].includes(node.label)) {
      const callerCount = graphEdges.filter(e => e.to === node.id && e.type === 'CALLS').length;
      const calleeCount = graphEdges.filter(e => e.from === node.id && e.type === 'CALLS').length;

      nodes.push({
        id: node.id,
        name: node.name,
        type: node.label.toLowerCase() as any,
        file: node.filePath,
        line: node.startLine || 1,
        isExported: node.isExported || false,
        isEntryPoint: callerCount === 0 && calleeCount > 0,
        isExternal: false,
        callerCount,
        calleeCount,
      });

      // Identify entry points
      if (callerCount === 0 && calleeCount > 0) {
        let type: CallGraphEntryPoint['type'] = 'export';
        
        if (node.filePath.includes('cli')) type = 'cli_command';
        else if (node.name.includes('handler') || node.name.includes('Handler')) type = 'http_endpoint';
        else if (node.name === 'main' || node.name === 'index') type = 'main';

        entryPoints.push({
          nodeId: node.id,
          type,
          description: `Entry point: ${node.name}`,
          reachableNodes: calleeCount,
        });
      }
    }
  }

  // Convert graph edges to call graph edges
  for (const edge of graphEdges) {
    if (['CALLS', 'IMPORTS'].includes(edge.type)) {
      edges.push({
        from: edge.from,
        to: edge.to,
        type: edge.type.toLowerCase() as any,
        file: '',
        line: 0,
        confidence: edge.confidence || 1.0,
        isDynamic: false,
        isConditional: false,
      });
    }
  }

  return {
    nodes,
    edges,
    entryPoints,
    criticalPaths: [],
    dependencyUsage,
    unreachableCode: [],
  };
};

/**
 * Build vulnerability context information
 */
export const buildVulnerabilityContext = async (
  dependencies: any,
  callGraph: CallGraphInfo,
  docker: DockerDeepDiveInfo | null
): Promise<VulnerabilityContextInfo> => {
  const dependencyVulnerabilities: any[] = [];
  const codeVulnerabilities: any[] = [];
  const containerVulnerabilities: any[] = [];
  const applicabilityRules: any[] = [];
  const mitigatingFactors: any[] = [];

  // Build attack surface
  const attackSurface: AttackSurfaceInfo = {
    exposedPorts: [],
    publicEndpoints: [],
    externalConnections: [],
    dataFlows: [],
    trustBoundaries: [],
  };

  // Extract exposed ports from Docker
  if (docker) {
    for (const df of docker.dockerfiles) {
      for (const port of df.exposedPorts) {
        attackSurface.exposedPorts.push({
          port: port.port,
          protocol: port.protocol,
          service: path.basename(path.dirname(df.path)) || 'default',
          container: df.path,
          isPublic: true,
          hasAuth: false,
          hasTls: false,
        });
      }
    }
  }

  // Add applicability rules
  applicabilityRules.push({
    id: 'dev-dependency',
    name: 'Dev Dependency Rule',
    description: 'Vulnerabilities in dev dependencies are lower risk in production',
    condition: 'dependency.isDevDependency === true',
    appliesTo: 'dependency',
    reduces: true,
    reason: 'Dev dependencies are not included in production builds',
    matchedVulnerabilities: [],
  });

  applicabilityRules.push({
    id: 'not-reachable',
    name: 'Unreachable Code Rule',
    description: 'Vulnerabilities in unreachable code cannot be exploited',
    condition: 'dependency.isReachable === false',
    appliesTo: 'dependency',
    reduces: true,
    reason: 'Vulnerable function is not called from any entry point',
    matchedVulnerabilities: [],
  });

  applicabilityRules.push({
    id: 'not-in-container',
    name: 'Not in Container Rule',
    description: 'Vulnerabilities in files not copied to container are not exploitable in production',
    condition: 'file.inProductionContainer === false',
    appliesTo: 'code',
    reduces: true,
    reason: 'File is not included in any production container',
    matchedVulnerabilities: [],
  });

  // Add mitigating factors
  if (docker?.securityConfig.rootContainers.length === 0) {
    mitigatingFactors.push({
      type: 'non_root',
      description: 'All containers run as non-root user',
      appliesTo: ['*'],
      confidenceReduction: 0.2,
    });
  }

  return {
    dependencyVulnerabilities,
    codeVulnerabilities,
    containerVulnerabilities,
    applicabilityRules,
    mitigatingFactors,
    attackSurface,
  };
};
