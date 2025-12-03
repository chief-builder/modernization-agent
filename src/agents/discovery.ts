/**
 * Discovery Agent
 *
 * Responsible for analyzing the codebase to create a comprehensive functionality map.
 * Uses both static analysis and runtime observation.
 */

import type {
  FunctionalityMap,
  Feature,
  SourceAnalysis,
  EntryPoint,
  APIEndpoint,
  UndocumentedBehavior,
  ExternalDependency,
  DatabaseSchema,
  ModernizationState,
} from '../types.js';
import { loadState, saveState, saveFunctionalityMap, markDiscoveryComplete } from '../state.js';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, extname, basename, dirname } from 'node:path';
import { glob } from 'glob';

/**
 * Language detection patterns
 */
const LANGUAGE_PATTERNS: Record<string, { extensions: string[]; markers: string[] }> = {
  typescript: {
    extensions: ['.ts', '.tsx'],
    markers: ['tsconfig.json', 'package.json'],
  },
  javascript: {
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    markers: ['package.json'],
  },
  python: {
    extensions: ['.py'],
    markers: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
  },
  go: {
    extensions: ['.go'],
    markers: ['go.mod', 'go.sum'],
  },
  rust: {
    extensions: ['.rs'],
    markers: ['Cargo.toml'],
  },
  java: {
    extensions: ['.java'],
    markers: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
  },
  ruby: {
    extensions: ['.rb'],
    markers: ['Gemfile', 'Rakefile'],
  },
  php: {
    extensions: ['.php'],
    markers: ['composer.json'],
  },
};

/**
 * Framework detection patterns
 */
const FRAMEWORK_PATTERNS: Record<string, { language: string; markers: string[] }> = {
  // TypeScript/JavaScript
  vue: { language: 'typescript', markers: ['vue.config.js', 'nuxt.config', '.vue'] },
  react: { language: 'typescript', markers: ['react-dom', 'jsx', 'tsx'] },
  angular: { language: 'typescript', markers: ['angular.json', '@angular/core'] },
  express: { language: 'typescript', markers: ['express'] },
  nestjs: { language: 'typescript', markers: ['@nestjs/core'] },
  nextjs: { language: 'typescript', markers: ['next.config'] },

  // Python
  django: { language: 'python', markers: ['django', 'manage.py'] },
  flask: { language: 'python', markers: ['flask', 'Flask'] },
  fastapi: { language: 'python', markers: ['fastapi', 'FastAPI'] },

  // Go
  gin: { language: 'go', markers: ['gin-gonic/gin'] },
  echo: { language: 'go', markers: ['labstack/echo'] },
  fiber: { language: 'go', markers: ['gofiber/fiber'] },

  // Rust
  actix: { language: 'rust', markers: ['actix-web'] },
  axum: { language: 'rust', markers: ['axum'] },
  rocket: { language: 'rust', markers: ['rocket'] },

  // Java
  spring: { language: 'java', markers: ['spring-boot', 'springframework'] },

  // Ruby
  rails: { language: 'ruby', markers: ['rails', 'Rails'] },
  sinatra: { language: 'ruby', markers: ['sinatra'] },
};

/**
 * Entry point patterns by language
 */
const ENTRY_POINT_PATTERNS: Record<string, string[]> = {
  typescript: ['src/index.ts', 'src/main.ts', 'src/app.ts', 'index.ts', 'server.ts'],
  javascript: ['src/index.js', 'src/main.js', 'index.js', 'server.js', 'app.js'],
  python: ['main.py', 'app.py', 'run.py', '__main__.py', 'manage.py', 'wsgi.py'],
  go: ['main.go', 'cmd/*/main.go'],
  rust: ['src/main.rs', 'src/lib.rs'],
  java: ['src/main/java/**/Application.java', '**/Main.java'],
  ruby: ['config.ru', 'app.rb', 'main.rb'],
  php: ['index.php', 'public/index.php'],
};

/**
 * Feature category detection patterns
 */
const FEATURE_CATEGORY_PATTERNS: Record<string, string[]> = {
  authentication: ['auth', 'login', 'logout', 'signin', 'signup', 'session', 'jwt', 'oauth', 'password'],
  api: ['api', 'endpoint', 'route', 'controller', 'handler', 'rest', 'graphql'],
  database: ['model', 'schema', 'migration', 'repository', 'dao', 'entity', 'query'],
  ui: ['component', 'view', 'page', 'template', 'layout', 'widget'],
  utility: ['util', 'helper', 'common', 'shared', 'lib'],
  configuration: ['config', 'settings', 'env', 'environment'],
  testing: ['test', 'spec', '__tests__', 'tests'],
  middleware: ['middleware', 'interceptor', 'filter', 'guard'],
  service: ['service', 'provider', 'manager'],
  storage: ['storage', 'upload', 'file', 's3', 'blob'],
  cache: ['cache', 'redis', 'memcache'],
  queue: ['queue', 'job', 'worker', 'task', 'bull', 'celery'],
  notification: ['notification', 'email', 'sms', 'push'],
  analytics: ['analytics', 'tracking', 'metrics', 'telemetry'],
};

/**
 * Create an empty functionality map
 */
export function createEmptyFunctionalityMap(): FunctionalityMap {
  return {
    version: '1.0.0',
    discoveredAt: new Date().toISOString(),
    sourceAnalysis: {
      language: 'unknown',
      entryPoints: [],
      totalFiles: 0,
      totalLines: 0,
    },
    features: [],
    undocumentedBehaviors: [],
    externalDependencies: [],
  };
}

/**
 * Generate a unique feature ID
 */
export function generateFeatureId(name: string, category: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `${category}_${slug}_${Date.now().toString(36)}`;
}

/**
 * Detect the category of a feature based on its path and name
 */
export function detectFeatureCategory(path: string, name: string): string {
  const lowerPath = path.toLowerCase();
  const lowerName = name.toLowerCase();

  for (const [category, patterns] of Object.entries(FEATURE_CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerPath.includes(pattern) || lowerName.includes(pattern)) {
        return category;
      }
    }
  }

  return 'general';
}

/**
 * Parse API endpoints from source code patterns
 */
export function parseAPIEndpoint(
  method: string,
  path: string,
  authRequired: boolean = false
): APIEndpoint {
  return {
    method: method.toUpperCase(),
    path,
    authRequired,
    documented: false,
  };
}

/**
 * Create a new feature entry
 */
export function createFeature(
  name: string,
  path: string,
  lines: [number, number],
  discoveryMethod: 'static' | 'runtime' | 'static+runtime' = 'static'
): Feature {
  const category = detectFeatureCategory(path, name);

  return {
    id: generateFeatureId(name, category),
    name,
    category,
    discoveryMethod,
    sourceLocations: [{ file: path, lines }],
    dependencies: [],
  };
}

/**
 * Add an undocumented behavior
 */
export function createUndocumentedBehavior(
  description: string,
  evidence: string,
  affectedFeatures: string[],
  discoveredVia: 'runtime' | 'static' = 'runtime'
): UndocumentedBehavior {
  return {
    id: `ub_${Date.now().toString(36)}`,
    description,
    discoveredVia,
    evidence,
    affectedFeatures,
  };
}

/**
 * Add an external dependency
 */
export function createExternalDependency(
  name: string,
  type: string,
  usedBy: string[]
): ExternalDependency {
  return {
    name,
    type,
    usedBy,
  };
}

/**
 * Merge features that refer to the same functionality
 */
export function mergeFeatures(existing: Feature, newFeature: Feature): Feature {
  return {
    ...existing,
    sourceLocations: [
      ...existing.sourceLocations,
      ...newFeature.sourceLocations.filter(
        (loc) => !existing.sourceLocations.some((e) => e.file === loc.file)
      ),
    ],
    dependencies: [...new Set([...existing.dependencies, ...newFeature.dependencies])],
    apiEndpoints: existing.apiEndpoints || newFeature.apiEndpoints,
    uiComponents: existing.uiComponents || newFeature.uiComponents,
    discoveryMethod:
      existing.discoveryMethod === 'static' && newFeature.discoveryMethod === 'runtime'
        ? 'static+runtime'
        : existing.discoveryMethod,
    behavioralNotes: [
      ...(existing.behavioralNotes || []),
      ...(newFeature.behavioralNotes || []),
    ],
  };
}

/**
 * Add or update a feature in the map
 */
export function addOrUpdateFeature(
  map: FunctionalityMap,
  feature: Feature
): FunctionalityMap {
  const existingIndex = map.features.findIndex(
    (f) => f.name.toLowerCase() === feature.name.toLowerCase() && f.category === feature.category
  );

  if (existingIndex >= 0) {
    const existingFeature = map.features[existingIndex];
    if (existingFeature) {
      map.features[existingIndex] = mergeFeatures(existingFeature, feature);
    }
  } else {
    map.features.push(feature);
  }

  return map;
}

/**
 * Calculate feature complexity based on various factors
 */
export function calculateComplexity(feature: Feature): 'low' | 'medium' | 'high' {
  let score = 0;

  // Multiple source locations increase complexity
  score += feature.sourceLocations.length * 2;

  // Dependencies add complexity
  score += feature.dependencies.length;

  // API endpoints add complexity
  if (feature.apiEndpoints) {
    score += feature.apiEndpoints.length * 2;
  }

  // UI components add complexity
  if (feature.uiComponents) {
    score += feature.uiComponents.length;
  }

  // Undocumented behavior notes indicate complexity
  if (feature.behavioralNotes && feature.behavioralNotes.length > 0) {
    score += feature.behavioralNotes.length * 3;
  }

  if (score <= 5) return 'low';
  if (score <= 15) return 'medium';
  return 'high';
}

/**
 * Prioritize features for testing/migration
 */
export function prioritizeFeatures(map: FunctionalityMap): FunctionalityMap {
  const priorityMap: Record<string, number> = {
    authentication: 100,
    api: 90,
    database: 85,
    service: 80,
    middleware: 75,
    configuration: 70,
    storage: 65,
    cache: 60,
    queue: 55,
    notification: 50,
    ui: 45,
    analytics: 40,
    utility: 30,
    testing: 10,
    general: 20,
  };

  for (const feature of map.features) {
    // Calculate priority based on category and complexity
    let priority = priorityMap[feature.category] || 20;

    // Boost priority for features with many dependencies
    priority += feature.dependencies.length * 2;

    // Boost priority for features that are dependencies of others
    const dependentsCount = map.features.filter((f) =>
      f.dependencies.includes(feature.id)
    ).length;
    priority += dependentsCount * 5;

    // Calculate and assign complexity
    feature.complexity = calculateComplexity(feature);
    feature.priority = priority;
  }

  // Sort by priority (descending)
  map.features.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  return map;
}

/**
 * Generate a discovery report
 */
export function generateDiscoveryReport(map: FunctionalityMap): string {
  let report = `# Discovery Report

## Source Analysis

- **Language:** ${map.sourceAnalysis.language} ${map.sourceAnalysis.languageVersion || ''}
- **Framework:** ${map.sourceAnalysis.framework || 'None detected'} ${map.sourceAnalysis.frameworkVersion || ''}
- **Architecture:** ${map.sourceAnalysis.architecturePattern || 'Unknown'}
- **Total Files:** ${map.sourceAnalysis.totalFiles}
- **Total Lines:** ${map.sourceAnalysis.totalLines}

## Entry Points

`;

  for (const entry of map.sourceAnalysis.entryPoints) {
    report += `- \`${entry.file}\` (${entry.type})${entry.function ? `: ${entry.function}()` : ''}\n`;
  }

  report += `
## Features Summary

| Category | Count |
|----------|-------|
`;

  const categoryCounts: Record<string, number> = {};
  for (const feature of map.features) {
    categoryCounts[feature.category] = (categoryCounts[feature.category] || 0) + 1;
  }

  for (const [category, count] of Object.entries(categoryCounts).sort(
    (a, b) => b[1] - a[1]
  )) {
    report += `| ${category} | ${count} |\n`;
  }

  report += `
## High-Priority Features

`;

  const highPriority = map.features.filter((f) => (f.priority || 0) >= 80).slice(0, 10);
  for (const feature of highPriority) {
    report += `### ${feature.name}

- **Category:** ${feature.category}
- **Complexity:** ${feature.complexity || 'unknown'}
- **Priority:** ${feature.priority || 0}
- **Discovery Method:** ${feature.discoveryMethod}
- **Locations:** ${feature.sourceLocations.map((l) => l.file).join(', ')}
`;
    if (feature.apiEndpoints && feature.apiEndpoints.length > 0) {
      report += `- **API Endpoints:**\n`;
      for (const ep of feature.apiEndpoints) {
        report += `  - \`${ep.method} ${ep.path}\`${ep.authRequired ? ' (auth required)' : ''}\n`;
      }
    }
    report += '\n';
  }

  if (map.undocumentedBehaviors.length > 0) {
    report += `## Undocumented Behaviors

`;
    for (const behavior of map.undocumentedBehaviors) {
      report += `### ${behavior.description}

- **Discovered via:** ${behavior.discoveredVia}
- **Evidence:** ${behavior.evidence}
- **Affected Features:** ${behavior.affectedFeatures.join(', ')}

`;
    }
  }

  if (map.externalDependencies.length > 0) {
    report += `## External Dependencies

| Dependency | Type | Used By |
|------------|------|---------|
`;
    for (const dep of map.externalDependencies) {
      report += `| ${dep.name} | ${dep.type} | ${dep.usedBy.join(', ')} |\n`;
    }
  }

  return report;
}

/**
 * Save discovery results and update state
 */
export async function saveDiscoveryResults(
  projectDir: string,
  map: FunctionalityMap
): Promise<void> {
  // Prioritize features before saving
  const prioritizedMap = prioritizeFeatures(map);

  // Save the functionality map
  await saveFunctionalityMap(projectDir, prioritizedMap);

  // Update state
  const state = await loadState(projectDir);
  if (state) {
    state.functionalityMap = prioritizedMap;
    markDiscoveryComplete(state);
    await saveState(projectDir, state);
  }
}

/**
 * Check if a path exists
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse a JSON file safely
 */
async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Count lines in a file
 */
async function countLines(filePath: string): Promise<number> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

/**
 * Detect the primary language of a project
 */
export async function detectLanguage(projectDir: string): Promise<string> {
  for (const [language, { markers }] of Object.entries(LANGUAGE_PATTERNS)) {
    for (const marker of markers) {
      if (await pathExists(join(projectDir, marker))) {
        return language;
      }
    }
  }
  return 'unknown';
}

/**
 * Detect the framework used in a project
 */
export async function detectFramework(projectDir: string): Promise<string | undefined> {
  // First check package.json for dependencies
  const packageJson = await readJsonFile<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>(join(projectDir, 'package.json'));

  if (packageJson) {
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Check for framework dependencies
    const frameworkChecks: [string, string[]][] = [
      ['vue', ['vue', '@vue/cli-service', 'nuxt']],
      ['react', ['react', 'react-dom', 'next']],
      ['angular', ['@angular/core']],
      ['nestjs', ['@nestjs/core']],
      ['express', ['express']],
      ['nextjs', ['next']],
      ['nuxt', ['nuxt']],
    ];

    for (const [framework, deps] of frameworkChecks) {
      for (const dep of deps) {
        if (allDeps[dep]) {
          return framework;
        }
      }
    }
  }

  // Check for marker files
  for (const [framework, { markers }] of Object.entries(FRAMEWORK_PATTERNS)) {
    for (const marker of markers) {
      if (marker.includes('/') || marker.includes('.')) {
        if (await pathExists(join(projectDir, marker))) {
          return framework;
        }
      }
    }
  }

  return undefined;
}

/**
 * Detect architecture pattern (monorepo, layered, modular, etc.)
 */
export async function detectArchitecturePattern(projectDir: string): Promise<string> {
  // Check for monorepo markers
  const packageJson = await readJsonFile<{
    workspaces?: string[] | { packages?: string[] };
  }>(join(projectDir, 'package.json'));

  if (packageJson?.workspaces) {
    return 'monorepo';
  }

  if (await pathExists(join(projectDir, 'pnpm-workspace.yaml'))) {
    return 'monorepo';
  }

  if (await pathExists(join(projectDir, 'lerna.json'))) {
    return 'monorepo';
  }

  // Check for packages or apps directories
  if (await pathExists(join(projectDir, 'packages'))) {
    return 'monorepo';
  }

  // Check for layered architecture
  const layeredMarkers = ['controllers', 'services', 'repositories', 'models'];
  let layeredCount = 0;
  for (const marker of layeredMarkers) {
    if (await pathExists(join(projectDir, 'src', marker))) {
      layeredCount++;
    }
  }
  if (layeredCount >= 2) {
    return 'layered';
  }

  return 'modular';
}

/**
 * Find all workspace packages in a monorepo
 */
export async function findWorkspacePackages(projectDir: string): Promise<string[]> {
  const packages: string[] = [];

  // Check package.json workspaces
  const packageJson = await readJsonFile<{
    workspaces?: string[] | { packages?: string[] };
  }>(join(projectDir, 'package.json'));

  let workspacePatterns: string[] = [];

  if (Array.isArray(packageJson?.workspaces)) {
    workspacePatterns = packageJson.workspaces;
  } else if (packageJson?.workspaces?.packages) {
    workspacePatterns = packageJson.workspaces.packages;
  }

  // Also check pnpm-workspace.yaml
  if (await pathExists(join(projectDir, 'pnpm-workspace.yaml'))) {
    try {
      const pnpmWorkspace = await readFile(join(projectDir, 'pnpm-workspace.yaml'), 'utf-8');
      // Simple YAML parsing for packages array
      const match = pnpmWorkspace.match(/packages:\s*\n((?:\s+-\s+['"]?[^\n]+['"]?\n?)+)/);
      const matchedGroup = match?.[1];
      if (matchedGroup) {
        const patterns = matchedGroup.match(/-\s+['"]?([^\n'"]+)['"]?/g) || [];
        for (const p of patterns) {
          const pattern = p.replace(/-\s+['"]?/, '').replace(/['"]?$/, '').trim();
          if (pattern && !workspacePatterns.includes(pattern)) {
            workspacePatterns.push(pattern);
          }
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Resolve workspace patterns to actual directories
  for (const pattern of workspacePatterns) {
    const resolvedPaths = await glob(pattern, {
      cwd: projectDir,
      absolute: false,
    });
    for (const resolvedPath of resolvedPaths) {
      const pkgJsonPath = join(projectDir, resolvedPath, 'package.json');
      if (await pathExists(pkgJsonPath)) {
        packages.push(resolvedPath);
      }
    }
  }

  return packages;
}

/**
 * Find entry points in a project
 */
export async function findEntryPoints(
  projectDir: string,
  language: string
): Promise<EntryPoint[]> {
  const entryPoints: EntryPoint[] = [];

  // Check package.json for entry points
  const packageJson = await readJsonFile<{
    main?: string;
    module?: string;
    browser?: string;
    bin?: string | Record<string, string>;
    scripts?: Record<string, string>;
    exports?: Record<string, unknown>;
  }>(join(projectDir, 'package.json'));

  if (packageJson) {
    // Main field
    if (packageJson.main) {
      const mainPath = packageJson.main.replace(/^\.\//, '');
      entryPoints.push({
        file: mainPath,
        type: 'main',
      });
    }

    // Module field (ESM entry)
    if (packageJson.module) {
      const modulePath = packageJson.module.replace(/^\.\//, '');
      entryPoints.push({
        file: modulePath,
        type: 'module',
      });
    }

    // Bin entries
    if (packageJson.bin) {
      if (typeof packageJson.bin === 'string') {
        entryPoints.push({
          file: packageJson.bin.replace(/^\.\//, ''),
          type: 'cli',
        });
      } else {
        for (const [name, path] of Object.entries(packageJson.bin)) {
          entryPoints.push({
            file: path.replace(/^\.\//, ''),
            type: 'cli',
            function: name,
          });
        }
      }
    }

    // Exports field (modern Node.js)
    if (packageJson.exports) {
      const parseExports = (
        exports: Record<string, unknown>,
        prefix = ''
      ): void => {
        for (const [key, value] of Object.entries(exports)) {
          if (typeof value === 'string') {
            const cleanPath = value.replace(/^\.\//, '');
            const exportName = prefix ? `${prefix}/${key}` : key;
            if (!entryPoints.some((e) => e.file === cleanPath)) {
              entryPoints.push({
                file: cleanPath,
                type: 'export',
                function: exportName,
              });
            }
          } else if (typeof value === 'object' && value !== null) {
            parseExports(value as Record<string, unknown>, key);
          }
        }
      };
      parseExports(packageJson.exports);
    }
  }

  // Find files matching entry point patterns
  const patterns = ENTRY_POINT_PATTERNS[language] || [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: projectDir,
      absolute: false,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    });

    for (const match of matches) {
      if (!entryPoints.some((e) => e.file === match)) {
        entryPoints.push({
          file: match,
          type: 'source',
        });
      }
    }
  }

  // Also look for common dev server entry points
  const devPatterns = [
    'src/index.ts',
    'src/index.tsx',
    'src/main.ts',
    'src/main.tsx',
    'src/app.ts',
    'src/server.ts',
    'app/index.ts',
    'app/main.ts',
    'lib/index.ts',
  ];

  for (const pattern of devPatterns) {
    if (await pathExists(join(projectDir, pattern))) {
      if (!entryPoints.some((e) => e.file === pattern)) {
        entryPoints.push({
          file: pattern,
          type: 'source',
        });
      }
    }
  }

  return entryPoints;
}

/**
 * Extract dependencies from a project
 */
export async function extractDependencies(
  projectDir: string
): Promise<ExternalDependency[]> {
  const dependencies: ExternalDependency[] = [];

  // Read package.json
  const packageJson = await readJsonFile<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  }>(join(projectDir, 'package.json'));

  if (packageJson) {
    // Production dependencies
    if (packageJson.dependencies) {
      for (const [name, version] of Object.entries(packageJson.dependencies)) {
        dependencies.push({
          name,
          type: 'production',
          usedBy: [],
          configLocation: 'package.json',
          version,
        });
      }
    }

    // Dev dependencies
    if (packageJson.devDependencies) {
      for (const [name, version] of Object.entries(packageJson.devDependencies)) {
        dependencies.push({
          name,
          type: 'development',
          usedBy: [],
          configLocation: 'package.json',
          version,
        });
      }
    }

    // Peer dependencies
    if (packageJson.peerDependencies) {
      for (const [name, version] of Object.entries(packageJson.peerDependencies)) {
        dependencies.push({
          name,
          type: 'peer',
          usedBy: [],
          configLocation: 'package.json',
          version,
        });
      }
    }
  }

  return dependencies;
}

/**
 * Scan source files and count them
 */
export async function scanSourceFiles(
  projectDir: string,
  language: string
): Promise<{ files: string[]; totalLines: number }> {
  const languageConfig = LANGUAGE_PATTERNS[language];
  const extensions = languageConfig?.extensions || ['.ts', '.js'];

  const patterns = extensions.map((ext) => `**/*${ext}`);

  const files = await glob(patterns, {
    cwd: projectDir,
    absolute: false,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
      '**/*.min.js',
      '**/*.d.ts',
    ],
  });

  let totalLines = 0;
  for (const file of files) {
    totalLines += await countLines(join(projectDir, file));
  }

  return { files, totalLines };
}

/**
 * Extract features from source files based on patterns
 */
export async function extractFeatures(
  projectDir: string,
  sourceFiles: string[]
): Promise<Feature[]> {
  const features: Feature[] = [];
  const featureMap = new Map<string, Feature>();

  for (const file of sourceFiles) {
    const category = detectFeatureCategory(file, basename(file, extname(file)));
    const featureName = deriveFeatureName(file);

    // Group related files into features
    const existingFeature = featureMap.get(featureName);
    if (existingFeature) {
      existingFeature.sourceLocations.push({ file, lines: [1, 1] });
    } else {
      const feature = createFeature(featureName, file, [1, 1]);
      featureMap.set(featureName, feature);
      features.push(feature);
    }
  }

  return features;
}

/**
 * Derive a feature name from a file path
 */
function deriveFeatureName(filePath: string): string {
  const parts = filePath.split('/');
  const fileName = basename(filePath, extname(filePath));

  // Skip generic names
  const genericNames = ['index', 'main', 'app', 'utils', 'helpers', 'types', 'constants'];
  if (genericNames.includes(fileName.toLowerCase())) {
    // Use parent directory name
    if (parts.length >= 2) {
      const parentDir = parts[parts.length - 2];
      if (parentDir) {
        return parentDir;
      }
    }
  }

  return fileName;
}

/**
 * Run the full discovery process
 */
export async function runDiscovery(
  projectDir: string,
  onProgress?: (message: string) => void
): Promise<FunctionalityMap> {
  const log = (msg: string) => onProgress?.(msg);

  log('Starting discovery process');

  // Detect language
  log('Detecting project language');
  const language = await detectLanguage(projectDir);
  log(`Detected language: ${language}`);

  // Detect framework
  log('Detecting framework');
  const framework = await detectFramework(projectDir);
  if (framework) {
    log(`Detected framework: ${framework}`);
  }

  // Detect architecture
  log('Analyzing architecture pattern');
  const architecturePattern = await detectArchitecturePattern(projectDir);
  log(`Detected architecture: ${architecturePattern}`);

  // Initialize the map
  const map = createEmptyFunctionalityMap();
  map.sourceAnalysis.language = language;
  map.sourceAnalysis.framework = framework;
  map.sourceAnalysis.architecturePattern = architecturePattern;

  // Handle monorepo differently
  if (architecturePattern === 'monorepo') {
    log('Scanning monorepo workspaces');
    const workspaces = await findWorkspacePackages(projectDir);
    log(`Found ${workspaces.length} workspace packages`);

    let totalFiles = 0;
    let totalLines = 0;
    const allDependencies: ExternalDependency[] = [];
    const allFeatures: Feature[] = [];

    for (const workspace of workspaces) {
      const workspacePath = join(projectDir, workspace);
      log(`Scanning workspace: ${workspace}`);

      // Find entry points for this workspace
      const entryPoints = await findEntryPoints(workspacePath, language);
      for (const ep of entryPoints) {
        ep.file = join(workspace, ep.file);
        map.sourceAnalysis.entryPoints.push(ep);
      }

      // Extract dependencies
      const deps = await extractDependencies(workspacePath);
      for (const dep of deps) {
        dep.usedBy = [workspace];
        // Merge with existing dependency
        const existing = allDependencies.find((d) => d.name === dep.name);
        if (existing) {
          if (!existing.usedBy.includes(workspace)) {
            existing.usedBy.push(workspace);
          }
        } else {
          allDependencies.push(dep);
        }
      }

      // Scan source files
      const { files, totalLines: lines } = await scanSourceFiles(workspacePath, language);
      totalFiles += files.length;
      totalLines += lines;

      // Extract features
      const features = await extractFeatures(workspacePath, files);
      for (const f of features) {
        f.sourceLocations = f.sourceLocations.map((loc) => ({
          ...loc,
          file: join(workspace, loc.file),
        }));
        allFeatures.push(f);
      }
    }

    map.sourceAnalysis.totalFiles = totalFiles;
    map.sourceAnalysis.totalLines = totalLines;
    map.externalDependencies = allDependencies;
    map.features = allFeatures;
  } else {
    // Standard project discovery
    log('Scanning source files');
    const { files, totalLines } = await scanSourceFiles(projectDir, language);
    log(`Found ${files.length} source files with ${totalLines} total lines`);
    map.sourceAnalysis.totalFiles = files.length;
    map.sourceAnalysis.totalLines = totalLines;

    log('Finding entry points');
    const entryPoints = await findEntryPoints(projectDir, language);
    log(`Found ${entryPoints.length} entry points`);
    map.sourceAnalysis.entryPoints = entryPoints;

    log('Extracting external dependencies');
    const dependencies = await extractDependencies(projectDir);
    log(`Found ${dependencies.length} dependencies`);
    map.externalDependencies = dependencies;

    log('Extracting features from source code');
    const features = await extractFeatures(projectDir, files);
    log(`Extracted ${features.length} features`);
    map.features = features;
  }

  // Prioritize features
  log('Prioritizing features');
  const prioritizedMap = prioritizeFeatures(map);

  log('Discovery complete');
  return prioritizedMap;
}

/**
 * Export discovery utilities
 */
export const discovery = {
  createEmptyFunctionalityMap,
  generateFeatureId,
  detectFeatureCategory,
  parseAPIEndpoint,
  createFeature,
  createUndocumentedBehavior,
  createExternalDependency,
  mergeFeatures,
  addOrUpdateFeature,
  calculateComplexity,
  prioritizeFeatures,
  generateDiscoveryReport,
  saveDiscoveryResults,
  // New exports
  detectLanguage,
  detectFramework,
  detectArchitecturePattern,
  findWorkspacePackages,
  findEntryPoints,
  extractDependencies,
  scanSourceFiles,
  extractFeatures,
  runDiscovery,
  LANGUAGE_PATTERNS,
  FRAMEWORK_PATTERNS,
  ENTRY_POINT_PATTERNS,
  FEATURE_CATEGORY_PATTERNS,
};
