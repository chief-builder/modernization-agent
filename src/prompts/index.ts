/**
 * Agent Prompts Index
 *
 * Exports all agent prompts for the modernization system.
 */

export { getOrchestratorPrompt } from './orchestrator.js';
export { getDiscoveryPrompt } from './discovery.js';
export { getCoveragePrompt } from './coverage.js';
export { getEnhancementPrompt } from './enhancement.js';
export { getMigrationPrompt } from './migration.js';
export { getValidationPrompt } from './validation.js';

import type { ModernizationState, AgentType } from '../types.js';
import { getOrchestratorPrompt } from './orchestrator.js';
import { getDiscoveryPrompt } from './discovery.js';
import { getCoveragePrompt } from './coverage.js';
import { getEnhancementPrompt } from './enhancement.js';
import { getMigrationPrompt } from './migration.js';
import { getValidationPrompt } from './validation.js';

/**
 * Get the appropriate prompt for an agent type
 */
export function getPromptForAgent(
  agentType: AgentType,
  state: ModernizationState
): string {
  switch (agentType) {
    case 'orchestrator':
      return getOrchestratorPrompt(state);
    case 'discovery':
      return getDiscoveryPrompt(state);
    case 'coverage':
      return getCoveragePrompt(state);
    case 'enhancement':
      return getEnhancementPrompt(state);
    case 'migration':
      return getMigrationPrompt(state);
    case 'validation':
      return getValidationPrompt(state);
    default:
      return getOrchestratorPrompt(state);
  }
}
