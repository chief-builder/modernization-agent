/**
 * Security Module for the Modernization Agent System
 *
 * Implements defense-in-depth command validation and approval gates
 */

import type { CommandValidation, SecurityConfig, OperationMode } from './types.js';

/**
 * Default security configuration
 */
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  allowedCommands: [
    // Read-only operations
    'ls',
    'cat',
    'head',
    'tail',
    'grep',
    'find',
    'tree',
    'wc',
    'file',
    'stat',

    // Git read operations
    'git status',
    'git log',
    'git diff',
    'git show',
    'git branch',
    'git remote',

    // Git write operations (monitored)
    'git add',
    'git commit',
    'git checkout',
    'git switch',
    'git stash',

    // Package managers (read)
    'npm list',
    'npm outdated',
    'npm audit',
    'pnpm list',
    'yarn list',
    'pip list',
    'pip show',
    'go list',
    'cargo tree',

    // Package managers (install - monitored)
    'npm install',
    'npm ci',
    'pnpm install',
    'yarn install',
    'pip install',
    'go mod download',
    'cargo build',

    // Build and test
    'npm run',
    'npm test',
    'pnpm run',
    'pnpm test',
    'yarn run',
    'yarn test',
    'pytest',
    'go test',
    'cargo test',
    'vitest',
    'jest',

    // Coverage
    'coverage',
    'nyc',
    'c8',

    // Code analysis
    'eslint',
    'prettier',
    'tsc',
    'rustfmt',
    'gofmt',
    'black',
    'flake8',
    'mypy',

    // Process management (limited)
    'ps',
    'lsof',

    // File creation (monitored)
    'mkdir',
    'touch',
    'cp',
    'mv',
  ],

  blockedPatterns: [
    // Destructive operations
    'rm -rf /',
    'rm -rf ~',
    'rm -rf *',
    'dd if=',
    'mkfs',
    ':(){',
    'fork bomb',

    // Network exfiltration
    'curl.*|.*bash',
    'wget.*|.*sh',
    'nc -e',
    'netcat',

    // Privilege escalation
    'sudo',
    'su -',
    'chmod 777',
    'chown root',

    // Git dangerous operations
    'git push --force',
    'git push -f',
    'git reset --hard origin',
    'git clean -fdx',

    // Database destruction
    'DROP DATABASE',
    'DROP TABLE',
    'TRUNCATE',
    'DELETE FROM.*WHERE 1',

    // Secrets
    '/etc/passwd',
    '/etc/shadow',
    '.ssh/id_',
    'aws configure',
    'gcloud auth',
  ],

  requireApprovalFor: [
    // Git push operations
    'git push',

    // File deletion
    'rm ',
    'unlink',

    // Database modifications
    'DELETE FROM',
    'UPDATE.*SET',
    'ALTER TABLE',

    // Process termination
    'kill',
    'pkill',

    // System modifications
    'chmod',
    'chown',
  ],
};

/**
 * Mode-specific security adjustments
 */
export function getSecurityConfigForMode(
  mode: OperationMode,
  baseConfig: SecurityConfig = DEFAULT_SECURITY_CONFIG
): SecurityConfig {
  const config = { ...baseConfig };

  switch (mode) {
    case 'discovery':
      // Discovery mode is read-only, block all write operations
      config.requireApprovalFor = [
        ...config.requireApprovalFor,
        'git add',
        'git commit',
        'mkdir',
        'touch',
        'cp',
        'mv',
      ];
      break;

    case 'coverage':
      // Coverage mode can create test files
      // No additional restrictions
      break;

    case 'enhancement':
      // Enhancement mode can modify code
      // No additional restrictions
      break;

    case 'migration':
      // Migration mode needs extra caution
      config.requireApprovalFor = [
        ...config.requireApprovalFor,
        'npm install',
        'pnpm install',
        'pip install',
        'go mod',
        'cargo add',
      ];
      break;
  }

  return config;
}

/**
 * Parse a command string into individual commands
 * Handles pipes, &&, ||, and ;
 */
function parseCommands(command: string): string[] {
  const commands: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    // Handle quotes
    if ((char === '"' || char === "'") && command[i - 1] !== '\\') {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      }
      current += char;
      continue;
    }

    // Handle command separators (only if not in quotes)
    if (!inQuotes) {
      if (char === '|' || char === ';') {
        if (current.trim()) {
          commands.push(current.trim());
        }
        current = '';
        continue;
      }
      if (char === '&' && command[i + 1] === '&') {
        if (current.trim()) {
          commands.push(current.trim());
        }
        current = '';
        i++; // Skip next &
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) {
    commands.push(current.trim());
  }

  return commands;
}

/**
 * Get the base command from a command string
 */
function getBaseCommand(command: string): string {
  // Remove leading environment variables
  let cmd = command.replace(/^(\w+=\S+\s+)+/, '');

  // Get the first word (the actual command)
  const match = cmd.match(/^(\S+)/);
  return match ? match[1] : '';
}

/**
 * Check if a command matches any blocked pattern
 */
function matchesBlockedPattern(command: string, patterns: string[]): string | null {
  const lowerCommand = command.toLowerCase();

  for (const pattern of patterns) {
    // Check for exact match or regex match
    if (pattern.includes('.*')) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(command)) {
          return pattern;
        }
      } catch {
        // Invalid regex, treat as literal
        if (lowerCommand.includes(pattern.toLowerCase())) {
          return pattern;
        }
      }
    } else {
      if (lowerCommand.includes(pattern.toLowerCase())) {
        return pattern;
      }
    }
  }

  return null;
}

/**
 * Check if a command requires approval
 */
function requiresApproval(command: string, patterns: string[]): boolean {
  const lowerCommand = command.toLowerCase();

  for (const pattern of patterns) {
    if (lowerCommand.startsWith(pattern.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a command is in the allowlist
 */
function isAllowed(command: string, allowedCommands: string[]): boolean {
  const baseCmd = getBaseCommand(command);
  const lowerCommand = command.toLowerCase();

  for (const allowed of allowedCommands) {
    // Check if the base command matches
    if (allowed === baseCmd) {
      return true;
    }
    // Check if the full command starts with an allowed pattern
    if (lowerCommand.startsWith(allowed.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Validate a bash command for security
 */
export function validateCommand(
  command: string,
  config: SecurityConfig = DEFAULT_SECURITY_CONFIG
): CommandValidation {
  // Parse into individual commands
  const commands = parseCommands(command);

  if (commands.length === 0) {
    return {
      allowed: false,
      reason: 'Empty command',
    };
  }

  // Check each command
  for (const cmd of commands) {
    // Check blocked patterns first
    const blockedPattern = matchesBlockedPattern(cmd, config.blockedPatterns);
    if (blockedPattern) {
      return {
        allowed: false,
        reason: `Command matches blocked pattern: ${blockedPattern}`,
      };
    }

    // Check if command requires approval
    if (requiresApproval(cmd, config.requireApprovalFor)) {
      return {
        allowed: true,
        requiresApproval: true,
        reason: `Command requires approval: ${cmd}`,
      };
    }

    // Check allowlist
    if (!isAllowed(cmd, config.allowedCommands)) {
      return {
        allowed: false,
        reason: `Command not in allowlist: ${getBaseCommand(cmd)}`,
      };
    }
  }

  return {
    allowed: true,
  };
}

/**
 * Check if a file path is safe to access
 */
export function isPathSafe(path: string, projectDir: string): boolean {
  // Normalize paths
  const normalizedPath = path.replace(/\\/g, '/');
  const normalizedProject = projectDir.replace(/\\/g, '/');

  // Block absolute paths outside project
  if (normalizedPath.startsWith('/') && !normalizedPath.startsWith(normalizedProject)) {
    // Allow /tmp for temporary files
    if (!normalizedPath.startsWith('/tmp')) {
      return false;
    }
  }

  // Block path traversal
  if (normalizedPath.includes('../')) {
    // Check if it resolves outside project
    const resolved = resolvePath(projectDir, path);
    if (!resolved.startsWith(normalizedProject)) {
      return false;
    }
  }

  // Block sensitive paths
  const sensitivePatterns = [
    '/etc/',
    '/var/log/',
    '.ssh/',
    '.aws/',
    '.env',
    'credentials',
    'secrets',
    '.git/config',
  ];

  for (const pattern of sensitivePatterns) {
    if (normalizedPath.includes(pattern)) {
      return false;
    }
  }

  return true;
}

/**
 * Simple path resolution (no actual filesystem access)
 */
function resolvePath(base: string, relative: string): string {
  if (relative.startsWith('/')) {
    return relative;
  }

  const parts = base.split('/').filter(Boolean);
  const relativeParts = relative.split('/');

  for (const part of relativeParts) {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.') {
      parts.push(part);
    }
  }

  return '/' + parts.join('/');
}

/**
 * Sanitize output to remove sensitive information
 */
export function sanitizeOutput(output: string): string {
  // Patterns to redact
  const sensitivePatterns = [
    // API keys and tokens
    /(?:api[_-]?key|token|secret|password|auth)[=:]\s*['"]?[\w-]+['"]?/gi,
    // AWS credentials
    /AKIA[0-9A-Z]{16}/g,
    // Private keys
    /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA )?PRIVATE KEY-----/g,
    // Connection strings
    /(?:mongodb|postgres|mysql|redis):\/\/[^\s]+/gi,
    // Email addresses (optional)
    // /[\w.-]+@[\w.-]+\.\w+/g,
  ];

  let sanitized = output;

  for (const pattern of sensitivePatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  return sanitized;
}
