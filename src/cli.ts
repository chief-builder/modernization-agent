#!/usr/bin/env node

/**
 * CLI Entry Point for the Modernization Agent System
 *
 * Usage:
 *   modernize discover [project-path]     - Analyze and document codebase functionality
 *   modernize coverage [project-path]     - Analyze and improve test coverage
 *   modernize enhance [project-path]      - Apply enhancements from spec file
 *   modernize migrate [project-path]      - Migrate to target tech stack
 *   modernize status [project-path]       - Show current modernization status
 *   modernize approve <approval-id>       - Approve a pending operation
 *   modernize reject <approval-id>        - Reject a pending operation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

import type { OperationMode, AgentConfig } from './types.js';
import {
  loadState,
  saveState,
  isInitialized,
  getPendingApprovals,
  resolveApproval,
} from './state.js';
import {
  runOrchestrator,
  generateStatusReport,
  determineNextAgent,
  getModelForAgent,
  initializeProject,
} from './agents/orchestrator.js';
import { checkAuthentication } from './agents/runner.js';

const VERSION = '0.1.0';

/**
 * Display authentication status
 */
function displayAuthStatus(): void {
  const auth = checkAuthentication();
  if (auth.authenticated) {
    console.log(chalk.green(`Authentication: ${auth.method === 'oauth' ? 'OAuth Token' : 'API Key'}`));
  } else {
    console.log(chalk.yellow('\nAuthentication required for agent modes (coverage, enhance, migrate).'));
    console.log(chalk.gray('Set one of the following environment variables:'));
    console.log(chalk.gray('  - CLAUDE_CODE_OAUTH_TOKEN (for Claude MAX subscribers)'));
    console.log(chalk.gray('  - ANTHROPIC_API_KEY (for API key users)\n'));
  }
}

/**
 * Create the CLI program
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name('modernize')
    .description('Autonomous Codebase Modernization Agent System')
    .version(VERSION);

  // Discover command
  program
    .command('discover')
    .description('Analyze and document codebase functionality')
    .argument('[project-path]', 'Path to the project', '.')
    .option('-m, --model <model>', 'Model to use (opus, sonnet, haiku)', 'opus')
    .option('-v, --verbose', 'Enable verbose output')
    .option('--dry-run', 'Show what would be done without executing')
    .action(async (projectPath: string, options) => {
      await runMode('discovery', projectPath, options);
    });

  // Coverage command
  program
    .command('coverage')
    .description('Analyze and improve test coverage')
    .argument('[project-path]', 'Path to the project', '.')
    .option('-t, --target <percent>', 'Target coverage percentage', '80')
    .option('-m, --model <model>', 'Model to use (opus, sonnet, haiku)', 'sonnet')
    .option('-v, --verbose', 'Enable verbose output')
    .option('--dry-run', 'Show what would be done without executing')
    .action(async (projectPath: string, options) => {
      await runMode('coverage', projectPath, {
        ...options,
        coverageTarget: parseInt(options.target, 10),
      });
    });

  // Enhance command
  program
    .command('enhance')
    .description('Apply enhancements from a specification file')
    .argument('[project-path]', 'Path to the project', '.')
    .option('-s, --spec <file>', 'Enhancement specification file')
    .option('-m, --model <model>', 'Model to use (opus, sonnet, haiku)', 'sonnet')
    .option('-v, --verbose', 'Enable verbose output')
    .option('--dry-run', 'Show what would be done without executing')
    .action(async (projectPath: string, options) => {
      if (!options.spec) {
        console.error(chalk.red('Error: Enhancement spec file is required (-s, --spec)'));
        process.exit(1);
      }
      await runMode('enhancement', projectPath, options);
    });

  // Migrate command
  program
    .command('migrate')
    .description('Migrate to a target tech stack')
    .argument('[project-path]', 'Path to the project', '.')
    .requiredOption('-t, --target <stack>', 'Target stack (e.g., go:gin, typescript:express)')
    .option('-m, --model <model>', 'Model to use (opus, sonnet, haiku)', 'opus')
    .option('-v, --verbose', 'Enable verbose output')
    .option('--dry-run', 'Show what would be done without executing')
    .action(async (projectPath: string, options) => {
      await runMode('migration', projectPath, {
        ...options,
        targetStack: options.target,
      });
    });

  // Status command
  program
    .command('status')
    .description('Show current modernization status')
    .argument('[project-path]', 'Path to the project', '.')
    .action(async (projectPath: string) => {
      await showStatus(projectPath);
    });

  // Approve command
  program
    .command('approve')
    .description('Approve a pending operation')
    .argument('<approval-id>', 'ID of the approval request')
    .argument('[project-path]', 'Path to the project', '.')
    .action(async (approvalId: string, projectPath: string) => {
      await handleApproval(approvalId, projectPath, true);
    });

  // Reject command
  program
    .command('reject')
    .description('Reject a pending operation')
    .argument('<approval-id>', 'ID of the approval request')
    .argument('[project-path]', 'Path to the project', '.')
    .action(async (approvalId: string, projectPath: string) => {
      await handleApproval(approvalId, projectPath, false);
    });

  // Continue command
  program
    .command('continue')
    .description('Continue from the last session')
    .argument('[project-path]', 'Path to the project', '.')
    .option('-m, --model <model>', 'Model to use (opus, sonnet, haiku)')
    .option('-v, --verbose', 'Enable verbose output')
    .action(async (projectPath: string, options) => {
      await continueSession(projectPath, options);
    });

  // Report command
  program
    .command('report')
    .description('Generate a detailed report')
    .argument('[project-path]', 'Path to the project', '.')
    .option('-o, --output <file>', 'Output file path')
    .option('-f, --format <format>', 'Output format (markdown, json)', 'markdown')
    .action(async (projectPath: string, options) => {
      await generateReport(projectPath, options);
    });

  return program;
}

/**
 * Run a specific mode
 */
async function runMode(
  mode: OperationMode,
  projectPath: string,
  options: {
    model?: string;
    verbose?: boolean;
    dryRun?: boolean;
    spec?: string;
    targetStack?: string;
    coverageTarget?: number;
  }
): Promise<void> {
  const absolutePath = resolve(projectPath);
  const spinner = ora();

  console.log(chalk.blue(`\n🔧 Modernization Agent - ${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode\n`));
  console.log(chalk.gray(`Project: ${absolutePath}\n`));

  // Check authentication for modes that require Claude
  if (mode !== 'discovery') {
    displayAuthStatus();
    const auth = checkAuthentication();
    if (!auth.authenticated) {
      console.error(chalk.red('Cannot run agent without authentication.'));
      process.exit(1);
    }
  }

  // Check if already initialized
  const initialized = await isInitialized(absolutePath);

  if (!initialized) {
    spinner.start('Initializing modernization project...');

    try {
      await initializeProject(absolutePath, mode, {
        targetStack: options.targetStack,
        enhancementSpec: options.spec,
        coverageTarget: options.coverageTarget,
      });
      spinner.succeed('Project initialized');
    } catch (error) {
      spinner.fail('Failed to initialize project');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  } else {
    console.log(chalk.gray('Project already initialized, loading state...'));
  }

  // Load state
  const state = await loadState(absolutePath);
  if (!state) {
    console.error(chalk.red('Failed to load project state'));
    process.exit(1);
  }

  // Check for pending approvals
  const pendingApprovals = getPendingApprovals(state);
  if (pendingApprovals.length > 0) {
    console.log(chalk.yellow('\n⚠️  Pending Approvals Required:\n'));
    for (const approval of pendingApprovals) {
      console.log(chalk.yellow(`  ${approval.id}:`));
      console.log(chalk.gray(`    Operation: ${approval.operation}`));
      console.log(chalk.gray(`    Risk Level: ${approval.riskLevel}`));
      console.log(chalk.gray(`    Description: ${approval.description}`));
      console.log();
    }
    console.log(chalk.gray('Use `modernize approve <id>` or `modernize reject <id>` to proceed.\n'));
    return;
  }

  // Determine next agent
  const nextAgent = determineNextAgent(state, mode);
  const recommendedModel = getModelForAgent(nextAgent);
  const modelToUse = options.model || recommendedModel;

  console.log(chalk.cyan(`Next Agent: ${nextAgent}`));
  console.log(chalk.cyan(`Model: ${modelToUse}\n`));

  if (options.dryRun) {
    console.log(chalk.yellow('Dry run mode - no changes will be made.\n'));
    console.log(chalk.gray('Would execute:'));
    console.log(chalk.gray(`  - Agent: ${nextAgent}`));
    console.log(chalk.gray(`  - Model: ${modelToUse}`));
    console.log(chalk.gray(`  - Mode: ${mode}`));
    return;
  }

  // Run the orchestrator
  spinner.start(`Running ${nextAgent} agent...`);

  try {
    const config: AgentConfig = {
      projectDir: absolutePath,
      mode,
      model: modelToUse as 'opus' | 'sonnet' | 'haiku',
      specFile: options.spec,
      targetStack: options.targetStack,
      dryRun: options.dryRun,
      verbose: options.verbose,
    };

    const result = await runOrchestrator(config);

    if (result.error) {
      spinner.fail(result.error);
      process.exit(1);
    }

    spinner.succeed('Session completed');

    if (result.artifactsCreated && result.artifactsCreated.length > 0) {
      console.log(chalk.green('\nArtifacts created:'));
      for (const artifact of result.artifactsCreated) {
        console.log(chalk.gray(`  - ${artifact}`));
      }
    }

    if (result.artifactsModified && result.artifactsModified.length > 0) {
      console.log(chalk.green('\nArtifacts modified:'));
      for (const artifact of result.artifactsModified) {
        console.log(chalk.gray(`  - ${artifact}`));
      }
    }

    if (result.shouldContinue) {
      console.log(chalk.blue('\n✨ Run `modernize continue` to proceed with the next session.\n'));
    } else {
      console.log(chalk.green('\n✅ Modernization complete!\n'));
    }
  } catch (error) {
    spinner.fail('Agent execution failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

/**
 * Show status of the modernization project
 */
async function showStatus(projectPath: string): Promise<void> {
  const absolutePath = resolve(projectPath);

  const initialized = await isInitialized(absolutePath);
  if (!initialized) {
    console.log(chalk.yellow('\nNo modernization project found at this path.'));
    console.log(chalk.gray('Run `modernize discover`, `modernize coverage`, `modernize enhance`, or `modernize migrate` to start.\n'));
    return;
  }

  const state = await loadState(absolutePath);
  if (!state) {
    console.error(chalk.red('Failed to load project state'));
    process.exit(1);
  }

  const report = generateStatusReport(state);
  console.log(report);
}

/**
 * Handle approval/rejection
 */
async function handleApproval(
  approvalId: string,
  projectPath: string,
  approved: boolean
): Promise<void> {
  const absolutePath = resolve(projectPath);

  const state = await loadState(absolutePath);
  if (!state) {
    console.error(chalk.red('Failed to load project state'));
    process.exit(1);
  }

  const success = resolveApproval(state, approvalId, approved, 'cli-user');
  if (!success) {
    console.error(chalk.red(`Approval request not found: ${approvalId}`));
    process.exit(1);
  }

  await saveState(absolutePath, state);

  if (approved) {
    console.log(chalk.green(`\n✅ Approved: ${approvalId}\n`));
    console.log(chalk.gray('Run `modernize continue` to proceed.\n'));
  } else {
    console.log(chalk.yellow(`\n❌ Rejected: ${approvalId}\n`));
  }
}

/**
 * Continue from the last session
 */
async function continueSession(
  projectPath: string,
  options: { model?: string; verbose?: boolean }
): Promise<void> {
  const absolutePath = resolve(projectPath);

  const state = await loadState(absolutePath);
  if (!state) {
    console.error(chalk.red('No modernization project found. Run one of the mode commands first.'));
    process.exit(1);
  }

  // Continue with the current mode
  await runMode(state.mode, projectPath, options);
}

/**
 * Generate a detailed report
 */
async function generateReport(
  projectPath: string,
  options: { output?: string; format?: string }
): Promise<void> {
  const absolutePath = resolve(projectPath);

  const state = await loadState(absolutePath);
  if (!state) {
    console.error(chalk.red('No modernization project found.'));
    process.exit(1);
  }

  const report = generateStatusReport(state);

  if (options.output) {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(options.output, report, 'utf-8');
    console.log(chalk.green(`Report saved to: ${options.output}`));
  } else {
    console.log(report);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

// Run the CLI
main();
