/**
 * Tests for State Management Module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createInitialState,
  initializeModernizationDir,
  isInitialized,
  loadState,
  saveState,
  getModernizationDir,
  saveFunctionalityMap,
  loadFunctionalityMap,
  createSessionSummary,
  completeSessionSummary,
  addSessionSummary,
  addApprovalRequest,
  resolveApproval,
  getPendingApprovals,
  markDiscoveryComplete,
  updateCoverageMetrics,
  updateMigrationProgress,
} from '../state.js';
import type { ModernizationState, FunctionalityMap } from '../types.js';

describe('State Management', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `modernization-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getModernizationDir', () => {
    it('should return the .modernization directory path', () => {
      const result = getModernizationDir('/path/to/project');
      expect(result).toBe('/path/to/project/.modernization');
    });
  });

  describe('initializeModernizationDir', () => {
    it('should create .modernization directory structure', async () => {
      await initializeModernizationDir(testDir);

      const modDir = getModernizationDir(testDir);
      const sessionsDir = join(modDir, 'sessions');

      // Check directories exist by trying to read them
      const modDirExists = await isDirectoryExists(modDir);
      const sessionsDirExists = await isDirectoryExists(sessionsDir);

      expect(modDirExists).toBe(true);
      expect(sessionsDirExists).toBe(true);
    });
  });

  describe('createInitialState', () => {
    it('should create state with correct defaults', () => {
      const state = createInitialState(testDir, 'test-project', 'discovery');

      expect(state.version).toBe('1.0.0');
      expect(state.projectPath).toBe(testDir);
      expect(state.projectName).toBe('test-project');
      expect(state.mode).toBe('discovery');
      expect(state.currentPhase).toBe('initialization');
      expect(state.sessionNumber).toBe(0);
      expect(state.discoveryComplete).toBe(false);
      expect(state.coverageTarget).toBe(80);
      expect(state.currentCoverage).toBe(0);
      expect(state.featuresMigrated).toBe(0);
      expect(state.featuresTotal).toBe(0);
      expect(state.sessions).toEqual([]);
      expect(state.pendingApprovals).toEqual([]);
    });

    it('should set timestamps', () => {
      const before = new Date().toISOString();
      const state = createInitialState(testDir, 'test-project', 'coverage');
      const after = new Date().toISOString();

      expect(state.createdAt >= before).toBe(true);
      expect(state.createdAt <= after).toBe(true);
      expect(state.updatedAt).toBe(state.createdAt);
    });
  });

  describe('isInitialized', () => {
    it('should return false for uninitialized project', async () => {
      const result = await isInitialized(testDir);
      expect(result).toBe(false);
    });

    it('should return true after saving state', async () => {
      await initializeModernizationDir(testDir);
      const state = createInitialState(testDir, 'test', 'discovery');
      await saveState(testDir, state);

      const result = await isInitialized(testDir);
      expect(result).toBe(true);
    });
  });

  describe('saveState / loadState', () => {
    it('should save and load state correctly', async () => {
      await initializeModernizationDir(testDir);
      const state = createInitialState(testDir, 'test-project', 'enhancement');
      state.coverageTarget = 90;

      await saveState(testDir, state);
      const loaded = await loadState(testDir);

      expect(loaded).not.toBeNull();
      expect(loaded!.projectName).toBe('test-project');
      expect(loaded!.mode).toBe('enhancement');
      expect(loaded!.coverageTarget).toBe(90);
    });

    it('should update timestamp on save', async () => {
      await initializeModernizationDir(testDir);
      const state = createInitialState(testDir, 'test', 'discovery');
      const originalUpdatedAt = state.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await saveState(testDir, state);
      const loaded = await loadState(testDir);

      expect(loaded!.updatedAt > originalUpdatedAt).toBe(true);
    });

    it('should return null for non-existent state', async () => {
      const result = await loadState(testDir);
      expect(result).toBeNull();
    });
  });

  describe('FunctionalityMap persistence', () => {
    it('should save and load functionality map', async () => {
      await initializeModernizationDir(testDir);

      const map: FunctionalityMap = {
        version: '1.0.0',
        discoveredAt: new Date().toISOString(),
        sourceAnalysis: {
          language: 'typescript',
          entryPoints: [{ file: 'src/index.ts', type: 'main' }],
          totalFiles: 10,
          totalLines: 500,
        },
        features: [
          {
            id: 'feature_1',
            name: 'Test Feature',
            category: 'api',
            discoveryMethod: 'static',
            sourceLocations: [{ file: 'src/api.ts', lines: [1, 50] }],
            dependencies: [],
          },
        ],
        undocumentedBehaviors: [],
        externalDependencies: [],
      };

      await saveFunctionalityMap(testDir, map);
      const loaded = await loadFunctionalityMap(testDir);

      expect(loaded).not.toBeNull();
      expect(loaded!.sourceAnalysis.language).toBe('typescript');
      expect(loaded!.features).toHaveLength(1);
      expect(loaded!.features[0]!.name).toBe('Test Feature');
    });

    it('should return null for non-existent map', async () => {
      const result = await loadFunctionalityMap(testDir);
      expect(result).toBeNull();
    });
  });

  describe('Session Management', () => {
    it('should create session summary', () => {
      const summary = createSessionSummary(1, 'discovery');

      expect(summary.sessionNumber).toBe(1);
      expect(summary.agentType).toBe('discovery');
      expect(summary.operationsCompleted).toEqual([]);
      expect(summary.artifactsModified).toEqual([]);
      expect(summary.errors).toEqual([]);
      expect(summary.nextActions).toEqual([]);
      expect(summary.startedAt).toBeDefined();
    });

    it('should complete session summary', () => {
      const summary = createSessionSummary(1, 'coverage');

      completeSessionSummary(
        summary,
        ['analyzed coverage', 'generated tests'],
        ['src/tests/new.test.ts'],
        ['run validation'],
        ['minor warning']
      );

      expect(summary.completedAt).toBeDefined();
      expect(summary.operationsCompleted).toEqual(['analyzed coverage', 'generated tests']);
      expect(summary.artifactsModified).toEqual(['src/tests/new.test.ts']);
      expect(summary.nextActions).toEqual(['run validation']);
      expect(summary.errors).toEqual(['minor warning']);
      expect(summary.durationMinutes).toBeDefined();
    });

    it('should add session summary to state', () => {
      const state = createInitialState(testDir, 'test', 'discovery');
      const summary = createSessionSummary(1, 'discovery');

      addSessionSummary(state, summary);

      expect(state.sessions).toHaveLength(1);
      expect(state.sessionNumber).toBe(1);
    });
  });

  describe('Approval Management', () => {
    it('should add approval request', () => {
      const state = createInitialState(testDir, 'test', 'migration');

      const id = addApprovalRequest(state, {
        operation: 'git push',
        riskLevel: 'medium',
        description: 'Push changes to remote',
      });

      expect(id).toMatch(/^approval_\d+$/);
      expect(state.pendingApprovals).toHaveLength(1);
      expect(state.pendingApprovals[0]!.status).toBe('pending');
    });

    it('should resolve approval', () => {
      const state = createInitialState(testDir, 'test', 'migration');

      const id = addApprovalRequest(state, {
        operation: 'rm file.txt',
        riskLevel: 'low',
        description: 'Delete temporary file',
      });

      const result = resolveApproval(state, id, true, 'test-user');

      expect(result).toBe(true);
      expect(state.pendingApprovals[0]!.status).toBe('approved');
      expect(state.pendingApprovals[0]!.approvedBy).toBe('test-user');
    });

    it('should reject approval', () => {
      const state = createInitialState(testDir, 'test', 'migration');

      const id = addApprovalRequest(state, {
        operation: 'dangerous operation',
        riskLevel: 'critical',
        description: 'Very risky',
      });

      resolveApproval(state, id, false);

      expect(state.pendingApprovals[0]!.status).toBe('rejected');
    });

    it('should return false for non-existent approval', () => {
      const state = createInitialState(testDir, 'test', 'discovery');
      const result = resolveApproval(state, 'non-existent-id', true);
      expect(result).toBe(false);
    });

    it('should get pending approvals', () => {
      const state = createInitialState(testDir, 'test', 'migration');

      addApprovalRequest(state, {
        operation: 'op1',
        riskLevel: 'low',
        description: 'First',
      });

      const id2 = addApprovalRequest(state, {
        operation: 'op2',
        riskLevel: 'medium',
        description: 'Second',
      });

      addApprovalRequest(state, {
        operation: 'op3',
        riskLevel: 'high',
        description: 'Third',
      });

      // Resolve one
      resolveApproval(state, id2, true);

      const pending = getPendingApprovals(state);
      expect(pending).toHaveLength(2);
    });
  });

  describe('Progress Tracking', () => {
    it('should mark discovery complete', () => {
      const state = createInitialState(testDir, 'test', 'discovery');

      markDiscoveryComplete(state);

      expect(state.discoveryComplete).toBe(true);
      expect(state.currentPhase).toBe('discovery_complete');
    });

    it('should update coverage metrics', () => {
      const state = createInitialState(testDir, 'test', 'coverage');

      updateCoverageMetrics(state, 75.5);

      expect(state.currentCoverage).toBe(75.5);
    });

    it('should update migration progress', () => {
      const state = createInitialState(testDir, 'test', 'migration');

      updateMigrationProgress(state, 5, 10);

      expect(state.featuresMigrated).toBe(5);
      expect(state.featuresTotal).toBe(10);
    });
  });
});

// Helper function to check if directory exists
async function isDirectoryExists(path: string): Promise<boolean> {
  try {
    const { stat } = await import('node:fs/promises');
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}
