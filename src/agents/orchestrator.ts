/**
 * Orchestrator Agent
 *
 * Central coordination agent that manages the modernization workflow.
 * Determines which specialized agent to invoke based on current state and mode.
 */

import type {
  AgentConfig,
  ModernizationState,
  OperationMode,
  SessionResult,
  SessionSummary,
  AgentType,
} from '../types.js';
import {
  loadState,
  saveState,
  createInitialState,
  initializeModernizationDir,
  isInitialized,
  loadFunctionalityMap,
  loadTestCoverageMap,
  loadEnhancementPlan,
  loadMigrationPlan,
  saveFunctionalityMap,
  createSessionSummary,
  completeSessionSummary,
  addSessionSummary,
  getPendingApprovals,
  markDiscoveryComplete,
} from '../state.js';
import { getSecurityConfigForMode, validateCommand } from '../security.js';
import { runDiscovery } from './discovery.js';
import { basename } from 'node:path';

/**
 * Determine which agent should run next based on state and mode
 */
export function determineNextAgent(
  state: ModernizationState,
  mode: OperationMode
): AgentType {
  // Check for pending approvals first
  const pendingApprovals = getPendingApprovals(state);
  if (pendingApprovals.length > 0) {
    // Need human intervention before continuing
    return 'orchestrator';
  }

  switch (mode) {
    case 'discovery':
      if (!state.discoveryComplete) {
        return 'discovery';
      }
      return 'orchestrator'; // Discovery complete, orchestrator decides next

    case 'coverage':
      if (!state.discoveryComplete) {
        return 'discovery'; // Must discover first
      }
      if (state.currentCoverage < state.coverageTarget) {
        return 'coverage';
      }
      return 'validation'; // Validate the generated tests

    case 'enhancement':
      if (!state.discoveryComplete) {
        return 'discovery';
      }
      if (!state.testCoverageMap) {
        return 'coverage'; // Need baseline coverage
      }
      if (state.enhancementPlan) {
        const pending = state.enhancementPlan.enhancements.filter(
          (e) => e.status === 'pending' || e.status === 'in_progress'
        );
        if (pending.length > 0) {
          return 'enhancement';
        }
        return 'validation'; // Validate the enhancements
      }
      return 'enhancement'; // Create the plan

    case 'migration':
      if (!state.discoveryComplete) {
        return 'discovery';
      }
      if (!state.testCoverageMap) {
        return 'coverage'; // Need comprehensive tests before migration
      }
      if (state.featuresMigrated < state.featuresTotal) {
        return 'migration';
      }
      return 'validation'; // Final validation

    default:
      return 'orchestrator';
  }
}

/**
 * Get the recommended model for an agent type
 */
export function getModelForAgent(agentType: AgentType): 'opus' | 'sonnet' | 'haiku' {
  switch (agentType) {
    case 'orchestrator':
      return 'opus'; // Complex decision making
    case 'discovery':
      return 'opus'; // Deep analysis required
    case 'coverage':
      return 'sonnet'; // Test generation
    case 'enhancement':
      return 'sonnet'; // Code modification
    case 'migration':
      return 'opus'; // Complex translation
    case 'validation':
      return 'haiku'; // Quick validation checks
    default:
      return 'sonnet';
  }
}

/**
 * Calculate progress percentage based on mode
 */
export function calculateProgress(state: ModernizationState): number {
  switch (state.mode) {
    case 'discovery':
      return state.discoveryComplete ? 100 : state.sessionNumber * 20; // Estimate

    case 'coverage':
      if (!state.discoveryComplete) return 0;
      return Math.min(
        100,
        (state.currentCoverage / state.coverageTarget) * 100
      );

    case 'enhancement':
      if (!state.enhancementPlan) return 0;
      const totalEnhancements = state.enhancementPlan.enhancements.length;
      const completed = state.enhancementPlan.enhancements.filter(
        (e) => e.status === 'completed'
      ).length;
      return (completed / totalEnhancements) * 100;

    case 'migration':
      if (state.featuresTotal === 0) return 0;
      return (state.featuresMigrated / state.featuresTotal) * 100;

    default:
      return 0;
  }
}

/**
 * Generate a status report for the current state
 */
export function generateStatusReport(state: ModernizationState): string {
  const progress = calculateProgress(state);
  const pendingApprovals = getPendingApprovals(state);

  let report = `
## Modernization Status: ${state.projectName}

**Mode:** ${state.mode}
**Phase:** ${state.currentPhase}
**Progress:** ${progress.toFixed(1)}%
**Sessions Completed:** ${state.sessionNumber}

### Current State
`;

  switch (state.mode) {
    case 'discovery':
      report += `- Discovery Complete: ${state.discoveryComplete ? 'Yes' : 'No'}\n`;
      if (state.functionalityMap) {
        report += `- Features Found: ${state.functionalityMap.features.length}\n`;
        report += `- Undocumented Behaviors: ${state.functionalityMap.undocumentedBehaviors.length}\n`;
      }
      break;

    case 'coverage':
      report += `- Discovery Complete: ${state.discoveryComplete ? 'Yes' : 'No'}\n`;
      report += `- Current Coverage: ${state.currentCoverage}%\n`;
      report += `- Target Coverage: ${state.coverageTarget}%\n`;
      break;

    case 'enhancement':
      report += `- Discovery Complete: ${state.discoveryComplete ? 'Yes' : 'No'}\n`;
      if (state.enhancementPlan) {
        const total = state.enhancementPlan.enhancements.length;
        const completed = state.enhancementPlan.enhancements.filter(
          (e) => e.status === 'completed'
        ).length;
        report += `- Enhancements: ${completed}/${total} completed\n`;
      }
      break;

    case 'migration':
      report += `- Discovery Complete: ${state.discoveryComplete ? 'Yes' : 'No'}\n`;
      report += `- Features Migrated: ${state.featuresMigrated}/${state.featuresTotal}\n`;
      if (state.sourceStack && state.targetStack) {
        report += `- Source Stack: ${state.sourceStack.language} ${state.sourceStack.framework || ''}\n`;
        report += `- Target Stack: ${state.targetStack.language} ${state.targetStack.framework || ''}\n`;
      }
      break;
  }

  if (pendingApprovals.length > 0) {
    report += `\n### Pending Approvals\n`;
    for (const approval of pendingApprovals) {
      report += `- **${approval.operation}** (${approval.riskLevel}): ${approval.description}\n`;
    }
  }

  if (state.sessions.length > 0) {
    const lastSession = state.sessions[state.sessions.length - 1];
    if (lastSession) {
      report += `\n### Last Session (#${lastSession.sessionNumber})\n`;
      report += `- Agent: ${lastSession.agentType}\n`;
      report += `- Operations: ${lastSession.operationsCompleted.length}\n`;
      if (lastSession.errors.length > 0) {
        report += `- Errors: ${lastSession.errors.length}\n`;
      }
      if (lastSession.nextActions.length > 0) {
        report += `- Next Actions:\n`;
        for (const action of lastSession.nextActions) {
          report += `  - ${action}\n`;
        }
      }
    }
  }

  return report;
}

/**
 * Build the context for a specialized agent
 */
export async function buildAgentContext(
  state: ModernizationState,
  agentType: AgentType,
  config: AgentConfig
): Promise<string> {
  let context = `# Modernization Agent Context

## Project Information
- **Project:** ${state.projectName}
- **Path:** ${state.projectPath}
- **Mode:** ${state.mode}
- **Session:** #${state.sessionNumber + 1}

## Your Role: ${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent

`;

  // Add mode-specific context
  switch (agentType) {
    case 'discovery':
      context += `## Discovery Objectives
1. Analyze the source code structure
2. Identify all features and their locations
3. Map dependencies and integrations
4. Run the application to discover runtime behaviors
5. Document undocumented behaviors

## Output Requirements
Create/update: .modernization/functionality_map.json
`;
      break;

    case 'coverage':
      context += `## Coverage Objectives
1. Analyze current test coverage
2. Identify untested features from functionality_map.json
3. Generate tests for high-priority gaps
4. Run tests and verify they pass

## Current State
- Target Coverage: ${state.coverageTarget}%
- Current Coverage: ${state.currentCoverage}%
`;
      if (state.functionalityMap) {
        const untestedCount = state.functionalityMap.features.filter(
          (f) => !f.testCoverage?.hasTests
        ).length;
        context += `- Untested Features: ${untestedCount}\n`;
      }
      break;

    case 'enhancement':
      context += `## Enhancement Objectives
1. Review the enhancement specification
2. Plan changes that preserve existing functionality
3. Implement changes incrementally
4. Ensure all existing tests pass after each change

## Enhancement Spec
${state.enhancementSpec || 'No enhancement spec provided'}
`;
      break;

    case 'migration':
      context += `## Migration Objectives
1. Migrate features one at a time
2. Create equivalent implementation in target stack
3. Validate behavioral equivalence
4. Only proceed when validation passes

## Migration Details
- Source: ${state.sourceStack?.language || 'unknown'} ${state.sourceStack?.framework || ''}
- Target: ${state.targetStack?.language || 'unknown'} ${state.targetStack?.framework || ''}
- Progress: ${state.featuresMigrated}/${state.featuresTotal} features
`;
      break;

    case 'validation':
      context += `## Validation Objectives
1. Run all tests and verify they pass
2. Compare behavior against baseline
3. Check for regressions
4. Generate validation report
`;
      break;
  }

  // Add security context
  const securityConfig = getSecurityConfigForMode(state.mode);
  context += `
## Security Constraints
- Allowed commands are validated before execution
- The following operations require approval:
${securityConfig.requireApprovalFor.map((p) => `  - ${p}`).join('\n')}
`;

  // Add session history summary
  if (state.sessions.length > 0) {
    context += `
## Previous Sessions Summary
`;
    const recentSessions = state.sessions.slice(-3);
    for (const session of recentSessions) {
      context += `### Session #${session.sessionNumber} (${session.agentType})
- Operations: ${session.operationsCompleted.join(', ') || 'None'}
- Artifacts: ${session.artifactsModified.join(', ') || 'None'}
`;
      if (session.nextActions.length > 0) {
        context += `- Recommended: ${session.nextActions.join(', ')}\n`;
      }
    }
  }

  return context;
}

/**
 * Initialize a new modernization project
 */
export async function initializeProject(
  projectDir: string,
  mode: OperationMode,
  options: {
    targetStack?: string;
    enhancementSpec?: string;
    coverageTarget?: number;
  } = {}
): Promise<ModernizationState> {
  // Create directory structure
  await initializeModernizationDir(projectDir);

  // Create initial state
  const projectName = basename(projectDir);
  const state = createInitialState(projectDir, projectName, mode);

  // Apply options
  if (options.coverageTarget) {
    state.coverageTarget = options.coverageTarget;
  }
  if (options.enhancementSpec) {
    state.enhancementSpec = options.enhancementSpec;
  }
  if (options.targetStack) {
    // Parse target stack (e.g., "go:gin" or "typescript:express")
    const parts = options.targetStack.split(':');
    const language = parts[0] ?? 'unknown';
    const framework = parts[1];
    state.targetStack = {
      language,
      version: 'latest',
      framework,
      keyDependencies: [],
    };
  }

  // Save state
  await saveState(projectDir, state);

  return state;
}

/**
 * Run the orchestrator to determine and execute next steps
 */
export async function runOrchestrator(
  config: AgentConfig
): Promise<SessionResult> {
  const { projectDir, mode } = config;

  // Check if initialized
  const initialized = await isInitialized(projectDir);
  if (!initialized) {
    // Initialize new project
    await initializeProject(projectDir, mode, {
      targetStack: config.targetStack,
      enhancementSpec: config.specFile,
    });
  }

  // Load current state
  let state = await loadState(projectDir);
  if (!state) {
    return {
      shouldContinue: false,
      error: 'Failed to load project state',
    };
  }

  // Update mode if different
  if (state.mode !== mode) {
    state.mode = mode;
    await saveState(projectDir, state);
  }

  // Check for pending approvals
  const pendingApprovals = getPendingApprovals(state);
  const firstApproval = pendingApprovals[0];
  if (firstApproval) {
    return {
      shouldContinue: false,
      error: `Waiting for approval: ${firstApproval.description}`,
    };
  }

  // Determine next agent
  const nextAgent = determineNextAgent(state, mode);

  // Create session summary
  const sessionNumber = state.sessionNumber + 1;
  const summary = createSessionSummary(sessionNumber, nextAgent);

  // Update state
  state.sessionNumber = sessionNumber;
  await saveState(projectDir, state);

  const operations: string[] = [];
  const artifacts: string[] = [];

  // Execute agent based on type
  if (nextAgent === 'discovery') {
    // Run the discovery process
    const map = await runDiscovery(projectDir, (msg) => {
      operations.push(msg);
    });

    // Save the functionality map
    await saveFunctionalityMap(projectDir, map);
    artifacts.push('.modernization/functionality_map.json');

    // Update state
    state.functionalityMap = map;
    state.featuresTotal = map.features.length;
    markDiscoveryComplete(state);
    await saveState(projectDir, state);

    // Complete session
    completeSessionSummary(
      summary,
      operations,
      artifacts,
      ['Review functionality map', 'Run coverage analysis'],
      []
    );
    addSessionSummary(state, summary);
    await saveState(projectDir, state);

    return {
      shouldContinue: mode !== 'discovery',
      artifactsCreated: ['.modernization/state.json', ...artifacts],
    };
  }

  // For other agents, build context for external agent execution
  const context = await buildAgentContext(state, nextAgent, config);

  // Return information about what should run next
  return {
    shouldContinue: true,
    artifactsCreated: ['.modernization/state.json'],
  };
}

/**
 * Complete a session and save results
 */
export async function completeSession(
  projectDir: string,
  operations: string[],
  artifacts: string[],
  nextActions: string[],
  errors: string[] = []
): Promise<void> {
  const state = await loadState(projectDir);
  if (!state) {
    throw new Error('Failed to load state');
  }

  // Find current session
  const summary = createSessionSummary(
    state.sessionNumber,
    determineNextAgent(state, state.mode)
  );

  // Complete the summary
  completeSessionSummary(summary, operations, artifacts, nextActions, errors);

  // Add to state
  addSessionSummary(state, summary);

  // Save state
  await saveState(projectDir, state);
}

/**
 * Export orchestrator utilities
 */
export const orchestrator = {
  determineNextAgent,
  getModelForAgent,
  calculateProgress,
  generateStatusReport,
  buildAgentContext,
  initializeProject,
  runOrchestrator,
  completeSession,
};
