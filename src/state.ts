/**
 * State Management for the Modernization Agent System
 *
 * Handles persistence of modernization state in .modernization/ directory
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ModernizationState,
  OperationMode,
  SessionSummary,
  ApprovalRequest,
  FunctionalityMap,
  TestCoverageMap,
  EnhancementPlan,
  MigrationPlan,
} from './types.js';

const STATE_VERSION = '1.0.0';
const MODERNIZATION_DIR = '.modernization';
const STATE_FILE = 'state.json';
const FUNCTIONALITY_MAP_FILE = 'functionality_map.json';
const TEST_COVERAGE_FILE = 'test_coverage.json';
const ENHANCEMENT_PLAN_FILE = 'enhancement_plan.json';
const MIGRATION_PLAN_FILE = 'migration_plan.json';
const SESSIONS_DIR = 'sessions';

/**
 * Check if a file or directory exists
 */
async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the .modernization directory path
 */
export function getModernizationDir(projectDir: string): string {
  return join(projectDir, MODERNIZATION_DIR);
}

/**
 * Initialize the modernization directory structure
 */
export async function initializeModernizationDir(projectDir: string): Promise<void> {
  const modDir = getModernizationDir(projectDir);

  // Create main directory
  await mkdir(modDir, { recursive: true });

  // Create sessions subdirectory
  await mkdir(join(modDir, SESSIONS_DIR), { recursive: true });
}

/**
 * Check if modernization has been initialized for a project
 */
export async function isInitialized(projectDir: string): Promise<boolean> {
  const statePath = join(getModernizationDir(projectDir), STATE_FILE);
  return exists(statePath);
}

/**
 * Create initial state for a new modernization project
 */
export function createInitialState(
  projectDir: string,
  projectName: string,
  mode: OperationMode
): ModernizationState {
  const now = new Date().toISOString();

  return {
    version: STATE_VERSION,
    projectPath: projectDir,
    projectName,
    mode,
    currentPhase: 'initialization',
    sessionNumber: 0,
    createdAt: now,
    updatedAt: now,

    // Discovery
    discoveryComplete: false,

    // Coverage
    coverageTarget: 80,
    currentCoverage: 0,

    // Migration
    featuresMigrated: 0,
    featuresTotal: 0,

    // History
    sessions: [],
    pendingApprovals: [],
  };
}

/**
 * Load state from disk
 */
export async function loadState(projectDir: string): Promise<ModernizationState | null> {
  const statePath = join(getModernizationDir(projectDir), STATE_FILE);

  if (!(await exists(statePath))) {
    return null;
  }

  try {
    const content = await readFile(statePath, 'utf-8');
    return JSON.parse(content) as ModernizationState;
  } catch (error) {
    console.error('Failed to load state:', error);
    return null;
  }
}

/**
 * Save state to disk
 */
export async function saveState(
  projectDir: string,
  state: ModernizationState
): Promise<void> {
  const modDir = getModernizationDir(projectDir);
  const statePath = join(modDir, STATE_FILE);

  // Ensure directory exists
  await mkdir(modDir, { recursive: true });

  // Update timestamp
  state.updatedAt = new Date().toISOString();

  // Write state
  await writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Load functionality map
 */
export async function loadFunctionalityMap(
  projectDir: string
): Promise<FunctionalityMap | null> {
  const filePath = join(getModernizationDir(projectDir), FUNCTIONALITY_MAP_FILE);

  if (!(await exists(filePath))) {
    return null;
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as FunctionalityMap;
  } catch (error) {
    console.error('Failed to load functionality map:', error);
    return null;
  }
}

/**
 * Save functionality map
 */
export async function saveFunctionalityMap(
  projectDir: string,
  map: FunctionalityMap
): Promise<void> {
  const filePath = join(getModernizationDir(projectDir), FUNCTIONALITY_MAP_FILE);
  await writeFile(filePath, JSON.stringify(map, null, 2), 'utf-8');
}

/**
 * Load test coverage map
 */
export async function loadTestCoverageMap(
  projectDir: string
): Promise<TestCoverageMap | null> {
  const filePath = join(getModernizationDir(projectDir), TEST_COVERAGE_FILE);

  if (!(await exists(filePath))) {
    return null;
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as TestCoverageMap;
  } catch (error) {
    console.error('Failed to load test coverage map:', error);
    return null;
  }
}

/**
 * Save test coverage map
 */
export async function saveTestCoverageMap(
  projectDir: string,
  map: TestCoverageMap
): Promise<void> {
  const filePath = join(getModernizationDir(projectDir), TEST_COVERAGE_FILE);
  await writeFile(filePath, JSON.stringify(map, null, 2), 'utf-8');
}

/**
 * Load enhancement plan
 */
export async function loadEnhancementPlan(
  projectDir: string
): Promise<EnhancementPlan | null> {
  const filePath = join(getModernizationDir(projectDir), ENHANCEMENT_PLAN_FILE);

  if (!(await exists(filePath))) {
    return null;
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as EnhancementPlan;
  } catch (error) {
    console.error('Failed to load enhancement plan:', error);
    return null;
  }
}

/**
 * Save enhancement plan
 */
export async function saveEnhancementPlan(
  projectDir: string,
  plan: EnhancementPlan
): Promise<void> {
  const filePath = join(getModernizationDir(projectDir), ENHANCEMENT_PLAN_FILE);
  await writeFile(filePath, JSON.stringify(plan, null, 2), 'utf-8');
}

/**
 * Load migration plan
 */
export async function loadMigrationPlan(
  projectDir: string
): Promise<MigrationPlan | null> {
  const filePath = join(getModernizationDir(projectDir), MIGRATION_PLAN_FILE);

  if (!(await exists(filePath))) {
    return null;
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as MigrationPlan;
  } catch (error) {
    console.error('Failed to load migration plan:', error);
    return null;
  }
}

/**
 * Save migration plan
 */
export async function saveMigrationPlan(
  projectDir: string,
  plan: MigrationPlan
): Promise<void> {
  const filePath = join(getModernizationDir(projectDir), MIGRATION_PLAN_FILE);
  await writeFile(filePath, JSON.stringify(plan, null, 2), 'utf-8');
}

/**
 * Save session transcript
 */
export async function saveSessionTranscript(
  projectDir: string,
  sessionNumber: number,
  transcript: unknown
): Promise<void> {
  const sessionsDir = join(getModernizationDir(projectDir), SESSIONS_DIR);
  await mkdir(sessionsDir, { recursive: true });

  const filePath = join(sessionsDir, `session_${sessionNumber.toString().padStart(3, '0')}.json`);
  await writeFile(filePath, JSON.stringify(transcript, null, 2), 'utf-8');
}

/**
 * Add a session summary to state
 */
export function addSessionSummary(
  state: ModernizationState,
  summary: SessionSummary
): void {
  state.sessions.push(summary);
  state.sessionNumber = summary.sessionNumber;
}

/**
 * Create a new session summary
 */
export function createSessionSummary(
  sessionNumber: number,
  agentType: SessionSummary['agentType']
): SessionSummary {
  return {
    sessionNumber,
    agentType,
    startedAt: new Date().toISOString(),
    operationsCompleted: [],
    artifactsModified: [],
    errors: [],
    nextActions: [],
  };
}

/**
 * Complete a session summary
 */
export function completeSessionSummary(
  summary: SessionSummary,
  operations: string[],
  artifacts: string[],
  nextActions: string[],
  errors: string[] = []
): void {
  summary.completedAt = new Date().toISOString();
  summary.operationsCompleted = operations;
  summary.artifactsModified = artifacts;
  summary.nextActions = nextActions;
  summary.errors = errors;

  // Calculate duration
  const start = new Date(summary.startedAt);
  const end = new Date(summary.completedAt);
  summary.durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
}

/**
 * Add an approval request
 */
export function addApprovalRequest(
  state: ModernizationState,
  request: Omit<ApprovalRequest, 'id' | 'requestedAt' | 'status'>
): string {
  const id = `approval_${Date.now()}`;
  const fullRequest: ApprovalRequest = {
    ...request,
    id,
    requestedAt: new Date().toISOString(),
    status: 'pending',
  };
  state.pendingApprovals.push(fullRequest);
  return id;
}

/**
 * Resolve an approval request
 */
export function resolveApproval(
  state: ModernizationState,
  approvalId: string,
  approved: boolean,
  approvedBy?: string
): boolean {
  const request = state.pendingApprovals.find((r) => r.id === approvalId);
  if (!request) {
    return false;
  }

  request.status = approved ? 'approved' : 'rejected';
  request.approvedAt = new Date().toISOString();
  request.approvedBy = approvedBy;

  return true;
}

/**
 * Get pending approvals
 */
export function getPendingApprovals(state: ModernizationState): ApprovalRequest[] {
  return state.pendingApprovals.filter((r) => r.status === 'pending');
}

/**
 * Update discovery completion status
 */
export function markDiscoveryComplete(state: ModernizationState): void {
  state.discoveryComplete = true;
  state.currentPhase = 'discovery_complete';
}

/**
 * Update coverage metrics
 */
export function updateCoverageMetrics(
  state: ModernizationState,
  currentCoverage: number
): void {
  state.currentCoverage = currentCoverage;
}

/**
 * Update migration progress
 */
export function updateMigrationProgress(
  state: ModernizationState,
  featuresMigrated: number,
  featuresTotal: number
): void {
  state.featuresMigrated = featuresMigrated;
  state.featuresTotal = featuresTotal;
}
