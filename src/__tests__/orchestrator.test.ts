/**
 * Tests for Orchestrator Module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  determineNextAgent,
  getModelForAgent,
  calculateProgress,
  generateStatusReport,
  initializeProject,
} from '../agents/orchestrator.js';
import {
  createInitialState,
  addApprovalRequest,
  markDiscoveryComplete,
} from '../state.js';
import type { ModernizationState, EnhancementPlan } from '../types.js';

describe('Orchestrator Module', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `orchestrator-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('determineNextAgent', () => {
    describe('with pending approvals', () => {
      it('should return orchestrator when approvals are pending', () => {
        const state = createInitialState(testDir, 'test', 'migration');
        addApprovalRequest(state, {
          operation: 'git push',
          riskLevel: 'medium',
          description: 'Push changes',
        });

        const agent = determineNextAgent(state, 'migration');
        expect(agent).toBe('orchestrator');
      });
    });

    describe('discovery mode', () => {
      it('should return discovery agent when not complete', () => {
        const state = createInitialState(testDir, 'test', 'discovery');
        const agent = determineNextAgent(state, 'discovery');
        expect(agent).toBe('discovery');
      });

      it('should return orchestrator when complete', () => {
        const state = createInitialState(testDir, 'test', 'discovery');
        markDiscoveryComplete(state);
        const agent = determineNextAgent(state, 'discovery');
        expect(agent).toBe('orchestrator');
      });
    });

    describe('coverage mode', () => {
      it('should return discovery first if not complete', () => {
        const state = createInitialState(testDir, 'test', 'coverage');
        const agent = determineNextAgent(state, 'coverage');
        expect(agent).toBe('discovery');
      });

      it('should return coverage if discovery complete and coverage below target', () => {
        const state = createInitialState(testDir, 'test', 'coverage');
        markDiscoveryComplete(state);
        state.currentCoverage = 50;
        state.coverageTarget = 80;
        const agent = determineNextAgent(state, 'coverage');
        expect(agent).toBe('coverage');
      });

      it('should return validation when coverage target met', () => {
        const state = createInitialState(testDir, 'test', 'coverage');
        markDiscoveryComplete(state);
        state.currentCoverage = 85;
        state.coverageTarget = 80;
        const agent = determineNextAgent(state, 'coverage');
        expect(agent).toBe('validation');
      });
    });

    describe('enhancement mode', () => {
      it('should return discovery first if not complete', () => {
        const state = createInitialState(testDir, 'test', 'enhancement');
        const agent = determineNextAgent(state, 'enhancement');
        expect(agent).toBe('discovery');
      });

      it('should return enhancement after discovery', () => {
        const state = createInitialState(testDir, 'test', 'enhancement');
        markDiscoveryComplete(state);
        const agent = determineNextAgent(state, 'enhancement');
        expect(agent).toBe('enhancement');
      });

      it('should return enhancement when plan has pending items', () => {
        const state = createInitialState(testDir, 'test', 'enhancement');
        markDiscoveryComplete(state);
        state.enhancementPlan = {
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          enhancementSpec: 'spec',
          baselineTestResults: { total: 10, passed: 10, failed: 0, skipped: 0 },
          enhancements: [
            {
              id: 'e1',
              title: 'Feature 1',
              description: 'Desc',
              affectedFeatures: [],
              newFeatures: [],
              implementationSteps: [],
              riskLevel: 'low',
              requiresApproval: false,
              status: 'pending',
            },
          ],
        };
        const agent = determineNextAgent(state, 'enhancement');
        expect(agent).toBe('enhancement');
      });

      it('should return validation when all enhancements complete', () => {
        const state = createInitialState(testDir, 'test', 'enhancement');
        markDiscoveryComplete(state);
        state.enhancementPlan = {
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          enhancementSpec: 'spec',
          baselineTestResults: { total: 10, passed: 10, failed: 0, skipped: 0 },
          enhancements: [
            {
              id: 'e1',
              title: 'Feature 1',
              description: 'Desc',
              affectedFeatures: [],
              newFeatures: [],
              implementationSteps: [],
              riskLevel: 'low',
              requiresApproval: false,
              status: 'completed',
            },
          ],
        };
        const agent = determineNextAgent(state, 'enhancement');
        expect(agent).toBe('validation');
      });
    });

    describe('migration mode', () => {
      it('should return discovery first', () => {
        const state = createInitialState(testDir, 'test', 'migration');
        const agent = determineNextAgent(state, 'migration');
        expect(agent).toBe('discovery');
      });

      it('should return coverage after discovery if no coverage map', () => {
        const state = createInitialState(testDir, 'test', 'migration');
        markDiscoveryComplete(state);
        const agent = determineNextAgent(state, 'migration');
        expect(agent).toBe('coverage');
      });

      it('should return migration when ready', () => {
        const state = createInitialState(testDir, 'test', 'migration');
        markDiscoveryComplete(state);
        state.testCoverageMap = {
          version: '1.0.0',
          analyzedAt: new Date().toISOString(),
          overallCoverage: { lineCoverage: 80, branchCoverage: 75, functionCoverage: 85 },
          byFeature: [],
          untestedFeatures: [],
          generationQueue: [],
        };
        state.featuresTotal = 10;
        state.featuresMigrated = 5;
        const agent = determineNextAgent(state, 'migration');
        expect(agent).toBe('migration');
      });

      it('should return validation when all features migrated', () => {
        const state = createInitialState(testDir, 'test', 'migration');
        markDiscoveryComplete(state);
        state.testCoverageMap = {
          version: '1.0.0',
          analyzedAt: new Date().toISOString(),
          overallCoverage: { lineCoverage: 80, branchCoverage: 75, functionCoverage: 85 },
          byFeature: [],
          untestedFeatures: [],
          generationQueue: [],
        };
        state.featuresTotal = 10;
        state.featuresMigrated = 10;
        const agent = determineNextAgent(state, 'migration');
        expect(agent).toBe('validation');
      });
    });
  });

  describe('getModelForAgent', () => {
    it('should return opus for orchestrator', () => {
      expect(getModelForAgent('orchestrator')).toBe('opus');
    });

    it('should return opus for discovery', () => {
      expect(getModelForAgent('discovery')).toBe('opus');
    });

    it('should return sonnet for coverage', () => {
      expect(getModelForAgent('coverage')).toBe('sonnet');
    });

    it('should return sonnet for enhancement', () => {
      expect(getModelForAgent('enhancement')).toBe('sonnet');
    });

    it('should return opus for migration', () => {
      expect(getModelForAgent('migration')).toBe('opus');
    });

    it('should return haiku for validation', () => {
      expect(getModelForAgent('validation')).toBe('haiku');
    });
  });

  describe('calculateProgress', () => {
    it('should calculate discovery progress', () => {
      const state = createInitialState(testDir, 'test', 'discovery');
      state.sessionNumber = 3;
      expect(calculateProgress(state)).toBe(60); // 3 * 20

      markDiscoveryComplete(state);
      expect(calculateProgress(state)).toBe(100);
    });

    it('should calculate coverage progress', () => {
      const state = createInitialState(testDir, 'test', 'coverage');
      markDiscoveryComplete(state);
      state.currentCoverage = 60;
      state.coverageTarget = 80;

      const progress = calculateProgress(state);
      expect(progress).toBe(75); // 60/80 * 100
    });

    it('should calculate enhancement progress', () => {
      const state = createInitialState(testDir, 'test', 'enhancement');
      state.enhancementPlan = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        enhancementSpec: 'spec',
        baselineTestResults: { total: 0, passed: 0, failed: 0, skipped: 0 },
        enhancements: [
          { id: 'e1', title: 'E1', description: '', affectedFeatures: [], newFeatures: [], implementationSteps: [], riskLevel: 'low', requiresApproval: false, status: 'completed' },
          { id: 'e2', title: 'E2', description: '', affectedFeatures: [], newFeatures: [], implementationSteps: [], riskLevel: 'low', requiresApproval: false, status: 'pending' },
        ],
      };

      const progress = calculateProgress(state);
      expect(progress).toBe(50); // 1/2 complete
    });

    it('should calculate migration progress', () => {
      const state = createInitialState(testDir, 'test', 'migration');
      state.featuresMigrated = 7;
      state.featuresTotal = 10;

      const progress = calculateProgress(state);
      expect(progress).toBe(70);
    });

    it('should return 0 for migration with no features', () => {
      const state = createInitialState(testDir, 'test', 'migration');
      state.featuresTotal = 0;

      const progress = calculateProgress(state);
      expect(progress).toBe(0);
    });
  });

  describe('generateStatusReport', () => {
    it('should generate discovery status', () => {
      const state = createInitialState(testDir, 'test', 'discovery');
      state.functionalityMap = {
        version: '1.0.0',
        discoveredAt: new Date().toISOString(),
        sourceAnalysis: { language: 'typescript', entryPoints: [], totalFiles: 0, totalLines: 0 },
        features: [{ id: 'f1', name: 'Feature', category: 'api', discoveryMethod: 'static', sourceLocations: [], dependencies: [] }],
        undocumentedBehaviors: [],
        externalDependencies: [],
      };

      const report = generateStatusReport(state);

      expect(report).toContain('Modernization Status');
      expect(report).toContain('discovery');
      expect(report).toContain('Features Found: 1');
    });

    it('should generate coverage status', () => {
      const state = createInitialState(testDir, 'test', 'coverage');
      markDiscoveryComplete(state);
      state.currentCoverage = 65;
      state.coverageTarget = 80;

      const report = generateStatusReport(state);

      expect(report).toContain('coverage');
      expect(report).toContain('Current Coverage: 65%');
      expect(report).toContain('Target Coverage: 80%');
    });

    it('should include pending approvals', () => {
      const state = createInitialState(testDir, 'test', 'migration');
      addApprovalRequest(state, {
        operation: 'git push',
        riskLevel: 'medium',
        description: 'Push to main',
      });

      const report = generateStatusReport(state);

      expect(report).toContain('Pending Approvals');
      expect(report).toContain('git push');
    });

    it('should include session history', () => {
      const state = createInitialState(testDir, 'test', 'discovery');
      state.sessions.push({
        sessionNumber: 1,
        agentType: 'discovery',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        operationsCompleted: ['analyzed codebase'],
        artifactsModified: ['functionality_map.json'],
        errors: [],
        nextActions: ['run coverage'],
      });

      const report = generateStatusReport(state);

      expect(report).toContain('Last Session');
      expect(report).toContain('discovery');
    });
  });

  describe('initializeProject', () => {
    it('should create initial state', async () => {
      const state = await initializeProject(testDir, 'discovery');

      expect(state.projectPath).toBe(testDir);
      expect(state.mode).toBe('discovery');
      expect(state.discoveryComplete).toBe(false);
    });

    it('should apply coverage target option', async () => {
      const state = await initializeProject(testDir, 'coverage', { coverageTarget: 90 });

      expect(state.coverageTarget).toBe(90);
    });

    it('should apply enhancement spec option', async () => {
      const state = await initializeProject(testDir, 'enhancement', {
        enhancementSpec: 'Add feature X',
      });

      expect(state.enhancementSpec).toBe('Add feature X');
    });

    it('should apply target stack option', async () => {
      const state = await initializeProject(testDir, 'migration', {
        targetStack: 'go:gin',
      });

      expect(state.targetStack?.language).toBe('go');
      expect(state.targetStack?.framework).toBe('gin');
    });
  });
});
