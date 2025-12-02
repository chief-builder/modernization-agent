/**
 * Autonomous Codebase Modernization Agent System
 *
 * A multi-agent system for:
 * - Discovering and documenting codebase functionality
 * - Ensuring comprehensive test coverage
 * - Applying enhancements without breaking existing features
 * - Migrating between tech stacks with behavioral validation
 */

// Core types
export * from './types.js';

// State management
export {
  loadState,
  saveState,
  createInitialState,
  initializeModernizationDir,
  isInitialized,
  getModernizationDir,
  loadFunctionalityMap,
  saveFunctionalityMap,
  loadTestCoverageMap,
  saveTestCoverageMap,
  loadEnhancementPlan,
  saveEnhancementPlan,
  loadMigrationPlan,
  saveMigrationPlan,
  saveSessionTranscript,
  addSessionSummary,
  createSessionSummary,
  completeSessionSummary,
  addApprovalRequest,
  resolveApproval,
  getPendingApprovals,
  markDiscoveryComplete,
  updateCoverageMetrics,
  updateMigrationProgress,
} from './state.js';

// Security
export {
  DEFAULT_SECURITY_CONFIG,
  getSecurityConfigForMode,
  validateCommand,
  isPathSafe,
  sanitizeOutput,
} from './security.js';

// Orchestrator agent
export {
  orchestrator,
  determineNextAgent,
  getModelForAgent,
  calculateProgress,
  generateStatusReport,
  buildAgentContext,
  initializeProject,
  runOrchestrator,
  completeSession,
} from './agents/orchestrator.js';

// Discovery agent
export {
  discovery,
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
} from './agents/discovery.js';

// Agent prompts
export {
  getPromptForAgent,
  getOrchestratorPrompt,
  getDiscoveryPrompt,
  getCoveragePrompt,
  getEnhancementPrompt,
  getMigrationPrompt,
  getValidationPrompt,
} from './prompts/index.js';
