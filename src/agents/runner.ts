/**
 * Agent Runner
 *
 * Handles invoking Claude Agent SDK to run specialized agents.
 * Supports both OAuth token and API key authentication.
 */

import { query, type Options as SDKOptions } from '@anthropic-ai/claude-agent-sdk';
import type { AgentType, AgentConfig, SessionResult } from '../types.js';
import { getPromptForAgent } from '../prompts/index.js';
import { buildAgentContext } from './orchestrator.js';
import type { ModernizationState } from '../types.js';

/**
 * Check if authentication is configured
 */
export function checkAuthentication(): { authenticated: boolean; method?: string; error?: string } {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    return { authenticated: true, method: 'oauth' };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { authenticated: true, method: 'api_key' };
  }
  return {
    authenticated: false,
    error: 'Authentication required: Set CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY',
  };
}

/**
 * Map agent type to Claude model
 */
function getModelForAgentType(agentType: AgentType, preferredModel?: string): string {
  if (preferredModel) {
    // Map short names to full model IDs
    const modelMap: Record<string, string> = {
      opus: 'claude-opus-4-5-20250929',
      sonnet: 'claude-sonnet-4-5-20250929',
      haiku: 'claude-haiku-3-5-20250929',
    };
    return modelMap[preferredModel] || preferredModel;
  }

  // Default models by agent type
  switch (agentType) {
    case 'orchestrator':
    case 'discovery':
    case 'migration':
      return 'claude-opus-4-5-20250929';
    case 'coverage':
    case 'enhancement':
      return 'claude-sonnet-4-5-20250929';
    case 'validation':
      return 'claude-haiku-3-5-20250929';
    default:
      return 'claude-sonnet-4-5-20250929';
  }
}

/**
 * Get system prompt for agent type
 */
function getSystemPrompt(agentType: AgentType): string {
  const basePrompt = `You are an expert software engineer working as a ${agentType} agent in an autonomous codebase modernization system.

Your goal is to complete your assigned tasks systematically, test your changes thoroughly, and maintain high code quality throughout the process.

Key principles:
- Write clean, maintainable code following best practices
- Test every change before marking it complete
- Commit progress regularly with descriptive messages
- Document your work clearly
- Never break existing functionality`;

  const agentSpecificPrompts: Record<AgentType, string> = {
    orchestrator: `
You coordinate the overall modernization workflow, determining which agents to invoke and in what order.`,
    discovery: `
You analyze codebases to create comprehensive functionality maps, identifying features, dependencies, and architecture patterns.`,
    coverage: `
You analyze and improve test coverage, generating tests for untested features while ensuring all existing tests continue to pass.`,
    enhancement: `
You implement enhancements from specification files while preserving existing functionality and maintaining test coverage.`,
    migration: `
You migrate codebases between tech stacks, ensuring behavioral equivalence through comprehensive testing.`,
    validation: `
You validate changes by running tests, comparing behaviors, and ensuring no regressions were introduced.`,
  };

  return basePrompt + (agentSpecificPrompts[agentType] || '');
}

/**
 * Create SDK options for running an agent
 */
function createAgentOptions(
  agentType: AgentType,
  projectDir: string,
  model: string
): SDKOptions {
  return {
    model,
    systemPrompt: getSystemPrompt(agentType),
    cwd: projectDir,
    maxTurns: 500,
    allowedTools: [
      'Read',
      'Write',
      'Edit',
      'Glob',
      'Grep',
      'Bash',
      'Task',
      'TodoRead',
      'TodoWrite',
    ],
    permissionMode: 'acceptEdits',
  };
}

/**
 * Process messages from the agent session
 */
interface AgentMessage {
  type: string;
  subtype?: string;
  is_error?: boolean;
  errors?: string[];
  content?: string;
  tool?: string;
}

/**
 * Run an agent session using the Claude Agent SDK
 */
export async function runAgentSession(
  agentType: AgentType,
  state: ModernizationState,
  config: AgentConfig,
  onProgress?: (message: string) => void
): Promise<SessionResult> {
  // Check authentication
  const auth = checkAuthentication();
  if (!auth.authenticated) {
    return {
      shouldContinue: false,
      error: auth.error,
    };
  }

  const log = (msg: string) => onProgress?.(msg);
  log(`Starting ${agentType} agent session`);

  // Get the prompt for this agent
  const agentPrompt = getPromptForAgent(agentType, state);

  // Build additional context
  const context = await buildAgentContext(state, agentType, config);

  // Combine prompt with context
  const fullPrompt = `${context}\n\n${agentPrompt}`;

  // Get model
  const model = getModelForAgentType(agentType, config.model);
  log(`Using model: ${model}`);

  // Create options
  const options = createAgentOptions(agentType, config.projectDir, model);

  const operations: string[] = [];
  const artifacts: string[] = [];
  const errors: string[] = [];

  try {
    log('Running agent...');

    for await (const message of query({ prompt: fullPrompt, options })) {
      const msg = message as AgentMessage;

      // Process different message types
      switch (msg.type) {
        case 'assistant':
          if (msg.content) {
            log(`Agent: ${msg.content.substring(0, 100)}...`);
          }
          break;

        case 'tool_progress':
          if (msg.tool) {
            operations.push(`Tool: ${msg.tool}`);
            log(`Using tool: ${msg.tool}`);
          }
          break;

        case 'result':
          if (msg.is_error) {
            const errorMsg = msg.errors?.join(', ') || 'Unknown error';
            errors.push(errorMsg);
            log(`Error: ${errorMsg}`);
            return {
              shouldContinue: false,
              error: errorMsg,
              artifactsModified: artifacts,
            };
          }
          log('Agent session completed successfully');
          return {
            shouldContinue: true,
            artifactsCreated: artifacts,
          };
      }
    }

    return {
      shouldContinue: true,
      artifactsCreated: artifacts,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`Agent session failed: ${errorMessage}`);
    return {
      shouldContinue: false,
      error: errorMessage,
    };
  }
}

/**
 * Export runner utilities
 */
export const runner = {
  checkAuthentication,
  getModelForAgentType,
  getSystemPrompt,
  createAgentOptions,
  runAgentSession,
};
