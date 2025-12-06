/**
 * Tests for Discovery Module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createEmptyFunctionalityMap,
  generateFeatureId,
  detectFeatureCategory,
  createFeature,
  createUndocumentedBehavior,
  createExternalDependency,
  mergeFeatures,
  addOrUpdateFeature,
  calculateComplexity,
  prioritizeFeatures,
  generateDiscoveryReport,
  detectLanguage,
  detectFramework,
  detectArchitecturePattern,
  findWorkspacePackages,
  findEntryPoints,
  extractDependencies,
} from '../agents/discovery.js';
import type { Feature, FunctionalityMap } from '../types.js';

describe('Discovery Module', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `discovery-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('createEmptyFunctionalityMap', () => {
    it('should create map with correct structure', () => {
      const map = createEmptyFunctionalityMap();

      expect(map.version).toBe('1.0.0');
      expect(map.discoveredAt).toBeDefined();
      expect(map.sourceAnalysis.language).toBe('unknown');
      expect(map.sourceAnalysis.entryPoints).toEqual([]);
      expect(map.sourceAnalysis.totalFiles).toBe(0);
      expect(map.sourceAnalysis.totalLines).toBe(0);
      expect(map.features).toEqual([]);
      expect(map.undocumentedBehaviors).toEqual([]);
      expect(map.externalDependencies).toEqual([]);
    });
  });

  describe('generateFeatureId', () => {
    it('should generate IDs with correct format', () => {
      const id = generateFeatureId('User Login', 'authentication');

      expect(id).toMatch(/^authentication_user_login_[a-z0-9]+$/);
    });

    it('should sanitize special characters', () => {
      const id = generateFeatureId('API-Endpoint/v2', 'api');
      expect(id).toMatch(/^api_api_endpoint_v2_[a-z0-9]+$/);
    });
  });

  describe('detectFeatureCategory', () => {
    it('should detect authentication category', () => {
      expect(detectFeatureCategory('src/auth/login.ts', 'login')).toBe('authentication');
      expect(detectFeatureCategory('src/controllers/auth.ts', 'auth')).toBe('authentication');
      expect(detectFeatureCategory('src/jwt.ts', 'jwt')).toBe('authentication');
    });

    it('should detect api category', () => {
      expect(detectFeatureCategory('src/api/users.ts', 'users')).toBe('api');
      expect(detectFeatureCategory('src/routes/index.ts', 'routes')).toBe('api');
      expect(detectFeatureCategory('src/controllers/order.ts', 'order')).toBe('api');
    });

    it('should detect database category', () => {
      expect(detectFeatureCategory('src/models/user.ts', 'user')).toBe('database');
      expect(detectFeatureCategory('src/schema/order.ts', 'order')).toBe('database');
      expect(detectFeatureCategory('src/migrations/001.ts', 'migration')).toBe('database');
    });

    it('should detect ui category', () => {
      expect(detectFeatureCategory('src/components/Button.tsx', 'Button')).toBe('ui');
      expect(detectFeatureCategory('src/views/Dashboard.vue', 'Dashboard')).toBe('ui');
      expect(detectFeatureCategory('src/pages/home.tsx', 'home')).toBe('ui');
    });

    it('should detect testing category', () => {
      // The path or name must contain testing-related keywords
      // Note: paths with 'tests' or '__tests__' directory should match
      // Let's test with explicit test patterns in the path
      expect(detectFeatureCategory('__tests__/foo.test.ts', 'foo')).toBe('testing');
      expect(detectFeatureCategory('tests/bar.spec.ts', 'bar')).toBe('testing');
    });

    it('should return general for unknown categories', () => {
      expect(detectFeatureCategory('src/foo/bar.ts', 'bar')).toBe('general');
    });
  });

  describe('createFeature', () => {
    it('should create feature with correct structure', () => {
      const feature = createFeature('User Authentication', 'src/auth/login.ts', [1, 100]);

      expect(feature.name).toBe('User Authentication');
      expect(feature.category).toBe('authentication');
      expect(feature.discoveryMethod).toBe('static');
      expect(feature.sourceLocations).toHaveLength(1);
      expect(feature.sourceLocations[0].file).toBe('src/auth/login.ts');
      expect(feature.sourceLocations[0].lines).toEqual([1, 100]);
      expect(feature.dependencies).toEqual([]);
    });

    it('should allow specifying discovery method', () => {
      const feature = createFeature('Runtime Feature', 'src/dynamic.ts', [1, 50], 'runtime');
      expect(feature.discoveryMethod).toBe('runtime');
    });
  });

  describe('createUndocumentedBehavior', () => {
    it('should create undocumented behavior entry', () => {
      const behavior = createUndocumentedBehavior(
        'Silent retry on failure',
        'Found retry logic without documentation',
        ['feature_1', 'feature_2']
      );

      expect(behavior.id).toMatch(/^ub_/);
      expect(behavior.description).toBe('Silent retry on failure');
      expect(behavior.evidence).toBe('Found retry logic without documentation');
      expect(behavior.affectedFeatures).toEqual(['feature_1', 'feature_2']);
      expect(behavior.discoveredVia).toBe('runtime');
    });
  });

  describe('createExternalDependency', () => {
    it('should create external dependency entry', () => {
      const dep = createExternalDependency('axios', 'http-client', ['api_users', 'api_orders']);

      expect(dep.name).toBe('axios');
      expect(dep.type).toBe('http-client');
      expect(dep.usedBy).toEqual(['api_users', 'api_orders']);
    });
  });

  describe('mergeFeatures', () => {
    it('should merge source locations', () => {
      const existing: Feature = {
        id: 'feature_1',
        name: 'Auth',
        category: 'authentication',
        discoveryMethod: 'static',
        sourceLocations: [{ file: 'src/auth.ts', lines: [1, 50] }],
        dependencies: ['dep1'],
      };

      const newFeature: Feature = {
        id: 'feature_1',
        name: 'Auth',
        category: 'authentication',
        discoveryMethod: 'runtime',
        sourceLocations: [{ file: 'src/auth-utils.ts', lines: [1, 30] }],
        dependencies: ['dep2'],
      };

      const merged = mergeFeatures(existing, newFeature);

      expect(merged.sourceLocations).toHaveLength(2);
      expect(merged.dependencies).toContain('dep1');
      expect(merged.dependencies).toContain('dep2');
      expect(merged.discoveryMethod).toBe('static+runtime');
    });

    it('should not duplicate source locations', () => {
      const existing: Feature = {
        id: 'feature_1',
        name: 'Auth',
        category: 'authentication',
        discoveryMethod: 'static',
        sourceLocations: [{ file: 'src/auth.ts', lines: [1, 50] }],
        dependencies: [],
      };

      const newFeature: Feature = {
        id: 'feature_1',
        name: 'Auth',
        category: 'authentication',
        discoveryMethod: 'static',
        sourceLocations: [{ file: 'src/auth.ts', lines: [1, 50] }],
        dependencies: [],
      };

      const merged = mergeFeatures(existing, newFeature);
      expect(merged.sourceLocations).toHaveLength(1);
    });
  });

  describe('addOrUpdateFeature', () => {
    it('should add new feature', () => {
      const map = createEmptyFunctionalityMap();
      const feature = createFeature('New Feature', 'src/new.ts', [1, 100]);

      addOrUpdateFeature(map, feature);

      expect(map.features).toHaveLength(1);
      expect(map.features[0].name).toBe('New Feature');
    });

    it('should update existing feature', () => {
      const map = createEmptyFunctionalityMap();
      const feature1 = createFeature('Auth', 'src/auth.ts', [1, 50]);
      const feature2 = createFeature('Auth', 'src/auth-utils.ts', [1, 30]);

      addOrUpdateFeature(map, feature1);
      addOrUpdateFeature(map, feature2);

      expect(map.features).toHaveLength(1);
      expect(map.features[0].sourceLocations).toHaveLength(2);
    });
  });

  describe('calculateComplexity', () => {
    it('should return low for simple features', () => {
      const feature: Feature = {
        id: 'simple',
        name: 'Simple',
        category: 'utility',
        discoveryMethod: 'static',
        sourceLocations: [{ file: 'src/util.ts', lines: [1, 20] }],
        dependencies: [],
      };

      expect(calculateComplexity(feature)).toBe('low');
    });

    it('should return medium for moderately complex features', () => {
      const feature: Feature = {
        id: 'medium',
        name: 'Medium',
        category: 'api',
        discoveryMethod: 'static',
        sourceLocations: [
          { file: 'src/api.ts', lines: [1, 100] },
          { file: 'src/api-utils.ts', lines: [1, 50] },
        ],
        dependencies: ['dep1', 'dep2', 'dep3'],
        apiEndpoints: [
          { method: 'GET', path: '/users', authRequired: false, documented: true },
          { method: 'POST', path: '/users', authRequired: true, documented: true },
        ],
      };

      expect(calculateComplexity(feature)).toBe('medium');
    });

    it('should return high for complex features', () => {
      const feature: Feature = {
        id: 'complex',
        name: 'Complex',
        category: 'authentication',
        discoveryMethod: 'static+runtime',
        sourceLocations: [
          { file: 'src/auth.ts', lines: [1, 200] },
          { file: 'src/auth-utils.ts', lines: [1, 100] },
          { file: 'src/auth-middleware.ts', lines: [1, 50] },
        ],
        dependencies: ['dep1', 'dep2', 'dep3', 'dep4'],
        apiEndpoints: [
          { method: 'POST', path: '/login', authRequired: false, documented: true },
          { method: 'POST', path: '/logout', authRequired: true, documented: true },
          { method: 'POST', path: '/refresh', authRequired: true, documented: true },
        ],
        behavioralNotes: ['Complex session handling', 'Token refresh logic'],
      };

      expect(calculateComplexity(feature)).toBe('high');
    });
  });

  describe('prioritizeFeatures', () => {
    it('should prioritize authentication features', () => {
      const map = createEmptyFunctionalityMap();
      map.features = [
        createFeature('Utils', 'src/utils.ts', [1, 50]),
        createFeature('Login', 'src/auth/login.ts', [1, 100]),
        createFeature('Button', 'src/components/button.tsx', [1, 30]),
      ];

      const prioritized = prioritizeFeatures(map);

      expect(prioritized.features[0].category).toBe('authentication');
    });

    it('should assign complexity ratings', () => {
      const map = createEmptyFunctionalityMap();
      map.features = [createFeature('Feature', 'src/feature.ts', [1, 50])];

      const prioritized = prioritizeFeatures(map);

      expect(prioritized.features[0].complexity).toBeDefined();
      expect(prioritized.features[0].priority).toBeDefined();
    });
  });

  describe('generateDiscoveryReport', () => {
    it('should generate markdown report', () => {
      const map = createEmptyFunctionalityMap();
      map.sourceAnalysis = {
        language: 'typescript',
        framework: 'express',
        entryPoints: [{ file: 'src/index.ts', type: 'main' }],
        totalFiles: 50,
        totalLines: 5000,
      };
      map.features = [
        {
          id: 'auth_login',
          name: 'Login',
          category: 'authentication',
          discoveryMethod: 'static',
          sourceLocations: [{ file: 'src/auth.ts', lines: [1, 100] }],
          dependencies: [],
          priority: 100,
          complexity: 'medium',
        },
      ];

      const report = generateDiscoveryReport(map);

      expect(report).toContain('# Discovery Report');
      expect(report).toContain('**Language:** typescript');
      expect(report).toContain('**Framework:** express');
      expect(report).toContain('**Total Files:** 50');
      expect(report).toContain('authentication');
    });
  });

  describe('detectLanguage', () => {
    it('should detect TypeScript', async () => {
      await writeFile(join(testDir, 'tsconfig.json'), '{}');
      const lang = await detectLanguage(testDir);
      expect(lang).toBe('typescript');
    });

    it('should detect Python', async () => {
      await writeFile(join(testDir, 'requirements.txt'), 'flask==2.0.0');
      const lang = await detectLanguage(testDir);
      expect(lang).toBe('python');
    });

    it('should detect Go', async () => {
      await writeFile(join(testDir, 'go.mod'), 'module example.com/app');
      const lang = await detectLanguage(testDir);
      expect(lang).toBe('go');
    });

    it('should detect Rust', async () => {
      await writeFile(join(testDir, 'Cargo.toml'), '[package]');
      const lang = await detectLanguage(testDir);
      expect(lang).toBe('rust');
    });

    it('should detect Java', async () => {
      await writeFile(join(testDir, 'pom.xml'), '<project></project>');
      const lang = await detectLanguage(testDir);
      expect(lang).toBe('java');
    });

    it('should return unknown for empty project', async () => {
      const lang = await detectLanguage(testDir);
      expect(lang).toBe('unknown');
    });
  });

  describe('detectFramework', () => {
    it('should detect React', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' } })
      );
      const framework = await detectFramework(testDir);
      expect(framework).toBe('react');
    });

    it('should detect Vue', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ dependencies: { vue: '^3.0.0' } })
      );
      const framework = await detectFramework(testDir);
      expect(framework).toBe('vue');
    });

    it('should detect Nuxt (prioritized over Vue)', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ dependencies: { nuxt: '^3.0.0', vue: '^3.0.0' } })
      );
      const framework = await detectFramework(testDir);
      expect(framework).toBe('nuxt');
    });

    it('should detect Express', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ dependencies: { express: '^4.18.0' } })
      );
      const framework = await detectFramework(testDir);
      expect(framework).toBe('express');
    });

    it('should detect NestJS', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ dependencies: { '@nestjs/core': '^10.0.0' } })
      );
      const framework = await detectFramework(testDir);
      expect(framework).toBe('nestjs');
    });

    it('should return undefined for no framework', async () => {
      await writeFile(join(testDir, 'package.json'), JSON.stringify({ dependencies: {} }));
      const framework = await detectFramework(testDir);
      expect(framework).toBeUndefined();
    });
  });

  describe('detectArchitecturePattern', () => {
    it('should detect monorepo from package.json workspaces', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] })
      );
      const pattern = await detectArchitecturePattern(testDir);
      expect(pattern).toBe('monorepo');
    });

    it('should detect monorepo from pnpm-workspace.yaml', async () => {
      await writeFile(join(testDir, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"');
      await writeFile(join(testDir, 'package.json'), '{}');
      const pattern = await detectArchitecturePattern(testDir);
      expect(pattern).toBe('monorepo');
    });

    it('should detect monorepo from packages directory', async () => {
      await mkdir(join(testDir, 'packages'), { recursive: true });
      await writeFile(join(testDir, 'package.json'), '{}');
      const pattern = await detectArchitecturePattern(testDir);
      expect(pattern).toBe('monorepo');
    });

    it('should detect layered architecture', async () => {
      await mkdir(join(testDir, 'src', 'controllers'), { recursive: true });
      await mkdir(join(testDir, 'src', 'services'), { recursive: true });
      await writeFile(join(testDir, 'package.json'), '{}');
      const pattern = await detectArchitecturePattern(testDir);
      expect(pattern).toBe('layered');
    });

    it('should default to modular', async () => {
      await writeFile(join(testDir, 'package.json'), '{}');
      const pattern = await detectArchitecturePattern(testDir);
      expect(pattern).toBe('modular');
    });
  });

  describe('findWorkspacePackages', () => {
    it('should find packages from npm workspaces', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] })
      );
      await mkdir(join(testDir, 'packages', 'pkg-a'), { recursive: true });
      await mkdir(join(testDir, 'packages', 'pkg-b'), { recursive: true });
      await writeFile(join(testDir, 'packages', 'pkg-a', 'package.json'), '{}');
      await writeFile(join(testDir, 'packages', 'pkg-b', 'package.json'), '{}');

      const packages = await findWorkspacePackages(testDir);

      expect(packages).toContain('packages/pkg-a');
      expect(packages).toContain('packages/pkg-b');
    });

    it('should return empty for non-monorepo', async () => {
      await writeFile(join(testDir, 'package.json'), '{}');
      const packages = await findWorkspacePackages(testDir);
      expect(packages).toEqual([]);
    });
  });

  describe('findEntryPoints', () => {
    it('should find main entry point', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ main: 'dist/index.js' })
      );

      const entryPoints = await findEntryPoints(testDir, 'typescript');

      expect(entryPoints.some((e) => e.file === 'dist/index.js' && e.type === 'main')).toBe(true);
    });

    it('should find bin entry points', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ bin: { mycli: 'dist/cli.js' } })
      );

      const entryPoints = await findEntryPoints(testDir, 'typescript');

      expect(entryPoints.some((e) => e.file === 'dist/cli.js' && e.type === 'cli')).toBe(true);
    });

    it('should find common source patterns', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      await writeFile(join(testDir, 'src', 'index.ts'), 'export {}');
      await writeFile(join(testDir, 'package.json'), '{}');

      const entryPoints = await findEntryPoints(testDir, 'typescript');

      expect(entryPoints.some((e) => e.file === 'src/index.ts')).toBe(true);
    });
  });

  describe('extractDependencies', () => {
    it('should extract production dependencies', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({
          dependencies: { express: '^4.18.0', lodash: '^4.17.21' },
        })
      );

      const deps = await extractDependencies(testDir);

      expect(deps.some((d) => d.name === 'express' && d.type === 'production')).toBe(true);
      expect(deps.some((d) => d.name === 'lodash' && d.type === 'production')).toBe(true);
    });

    it('should extract dev dependencies', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({
          devDependencies: { vitest: '^1.0.0', typescript: '^5.0.0' },
        })
      );

      const deps = await extractDependencies(testDir);

      expect(deps.some((d) => d.name === 'vitest' && d.type === 'development')).toBe(true);
      expect(deps.some((d) => d.name === 'typescript' && d.type === 'development')).toBe(true);
    });

    it('should extract peer dependencies', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({
          peerDependencies: { react: '^18.0.0' },
        })
      );

      const deps = await extractDependencies(testDir);

      expect(deps.some((d) => d.name === 'react' && d.type === 'peer')).toBe(true);
    });

    it('should include version information', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({
          dependencies: { express: '^4.18.0' },
        })
      );

      const deps = await extractDependencies(testDir);
      const express = deps.find((d) => d.name === 'express');

      expect(express?.version).toBe('^4.18.0');
    });
  });
});
