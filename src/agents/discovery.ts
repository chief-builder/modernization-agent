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
    map.features[existingIndex] = mergeFeatures(map.features[existingIndex], feature);
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
  LANGUAGE_PATTERNS,
  FRAMEWORK_PATTERNS,
  ENTRY_POINT_PATTERNS,
  FEATURE_CATEGORY_PATTERNS,
};
