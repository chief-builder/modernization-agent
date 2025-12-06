# Modernization Agent

An autonomous multi-agent system for codebase modernization, refactoring, and tech stack migration, built on the Claude Agent SDK.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Discovery Mode](#discovery-mode)
  - [Coverage Mode](#coverage-mode)
  - [Enhancement Mode](#enhancement-mode)
  - [Migration Mode](#migration-mode)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Security](#security)
- [API Reference](#api-reference)
- [Development](#development)
- [License](#license)

## Overview

The Modernization Agent is an AI-powered system that helps maintain, refactor, and modernize existing codebases through four specialized operational modes:

| Mode | Description |
|------|-------------|
| **Discovery** | Analyze and document codebase functionality, entry points, dependencies, and architecture |
| **Coverage** | Ensure comprehensive test coverage by identifying gaps and generating tests |
| **Enhancement** | Apply enhancements safely while preserving existing functionality |
| **Migration** | Perform tech stack migrations with behavioral validation |

## Features

- **Multi-Language Support**: TypeScript, JavaScript, Python, Go, Rust, Java, Ruby, PHP
- **Framework Detection**: Vue/Nuxt, React, Angular, NestJS, Express, Django, Flask, FastAPI, and more
- **Monorepo Support**: Automatically detects and scans workspace packages
- **Security-First Design**: Command allowlisting, pattern blocking, and approval gates
- **Stateful Workflows**: Tracks progress across sessions with resumable work
- **Human-in-the-Loop**: Approval gates for high-risk operations

## Installation

### Prerequisites

- Node.js 20.0.0 or higher
- npm, pnpm, or yarn

### Install from Source

```bash
git clone https://github.com/anthropics/modernization-agent.git
cd modernization-agent
npm install
npm run build
npm link  # Makes 'modernize' command available globally
```

### Authentication

The agent requires authentication for coverage, enhancement, and migration modes:

```bash
# Option 1: Claude MAX subscribers (OAuth)
export CLAUDE_CODE_OAUTH_TOKEN="your-oauth-token"

# Option 2: API key users
export ANTHROPIC_API_KEY="your-api-key"
```

## Quick Start

```bash
# Analyze a codebase (no authentication required)
modernize discover /path/to/project

# Improve test coverage (requires authentication)
modernize coverage /path/to/project --target 80

# Apply enhancements from a spec file
modernize enhance /path/to/project --spec enhancement.md

# Migrate to a new tech stack
modernize migrate /path/to/project --target go:gin

# Check progress
modernize status /path/to/project
```

## Usage

### Discovery Mode

Discovery mode analyzes your codebase to create a comprehensive functionality map. This is typically the first step in any modernization workflow.

```bash
modernize discover /path/to/project [options]
```

**Options:**
- `-m, --model <model>` - Model to use: opus, sonnet, haiku (default: opus)
- `-v, --verbose` - Enable verbose output
- `--dry-run` - Show what would be done without executing

**What it discovers:**
- Programming language and framework
- Architecture pattern (monorepo, layered, modular)
- Entry points from package.json (main, module, bin, exports)
- All external dependencies (production, dev, peer)
- Source files and feature extraction
- Workspace packages in monorepos

**Output:**
```
.modernization/
├── state.json              # Overall project state
└── functionality_map.json  # Detailed discovery results
```

### Coverage Mode

Coverage mode analyzes test coverage and generates tests to fill gaps.

```bash
modernize coverage /path/to/project [options]
```

**Options:**
- `-t, --target <percent>` - Target coverage percentage (default: 80)
- `-m, --model <model>` - Model to use: opus, sonnet, haiku (default: sonnet)
- `-v, --verbose` - Enable verbose output
- `--dry-run` - Show what would be done without executing

**Process:**
1. Detects the project's testing framework (vitest, jest, mocha, etc.)
2. Analyzes existing test coverage
3. Identifies untested features from the functionality map
4. Generates tests prioritized by feature importance
5. Validates tests pass lint and typecheck requirements

**Output:**
```
.modernization/
├── state.json           # Updated with coverage metrics
└── test_coverage.json   # Detailed coverage analysis
```

### Enhancement Mode

Enhancement mode applies new features or changes from a specification file while preserving existing functionality.

```bash
modernize enhance /path/to/project --spec enhancement.md [options]
```

**Options:**
- `-s, --spec <file>` - Enhancement specification file (required)
- `-m, --model <model>` - Model to use: opus, sonnet, haiku (default: sonnet)
- `-v, --verbose` - Enable verbose output
- `--dry-run` - Show what would be done without executing

**Spec File Format:**

```markdown
# Enhancement: Add User Notifications

## Description
Add email and push notification support for user events.

## Requirements
- Send email on user registration
- Send push notification on new messages
- Allow users to configure notification preferences

## Acceptance Criteria
- All existing tests pass
- New tests cover notification functionality
- No regressions in existing features
```

### Migration Mode

Migration mode rewrites your codebase to a new tech stack while ensuring behavioral equivalence.

```bash
modernize migrate /path/to/project --target <stack> [options]
```

**Options:**
- `-t, --target <stack>` - Target stack (required), e.g., `go:gin`, `typescript:express`
- `-m, --model <model>` - Model to use: opus, sonnet, haiku (default: opus)
- `-v, --verbose` - Enable verbose output
- `--dry-run` - Show what would be done without executing

**Target Stack Format:**
```
<language>:<framework>
```

**Examples:**
- `go:gin` - Migrate to Go with Gin framework
- `typescript:express` - Migrate to TypeScript with Express
- `python:fastapi` - Migrate to Python with FastAPI
- `rust:axum` - Migrate to Rust with Axum

**Strategy:**
The agent uses a "strangler fig" pattern by default:
1. Identify all features in source codebase
2. Migrate features one at a time
3. Validate behavioral equivalence for each feature
4. Only proceed when validation passes

### Additional Commands

#### Status

Check the current modernization status:

```bash
modernize status /path/to/project
```

#### Continue

Resume from the last session:

```bash
modernize continue /path/to/project
```

#### Approve/Reject

Handle pending approval requests:

```bash
modernize approve <approval-id> /path/to/project
modernize reject <approval-id> /path/to/project
```

#### Report

Generate a detailed report:

```bash
modernize report /path/to/project --output report.md
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI (cli.ts)                            │
│              User interface and command parsing                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Orchestrator Agent                            │
│    Coordinates workflow, determines next agent, manages state   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐
│ Discovery Agent │ │Coverage Agent │ │Enhancement Agent│
│                 │ │               │ │                 │
│ - Language      │ │ - Gap analysis│ │ - Spec parsing  │
│ - Framework     │ │ - Test gen    │ │ - Safe changes  │
│ - Dependencies  │ │ - Validation  │ │ - Regression    │
│ - Entry points  │ │               │ │   prevention    │
└─────────────────┘ └───────────────┘ └─────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     State Management                            │
│              Persists state in .modernization/                  │
└─────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/
├── cli.ts                 # CLI entry point and command handling
├── index.ts               # Public API exports
├── types.ts               # TypeScript type definitions
├── state.ts               # State persistence and management
├── security.ts            # Command validation and security
├── agents/
│   ├── orchestrator.ts    # Workflow coordination
│   ├── discovery.ts       # Codebase analysis
│   └── runner.ts          # Claude Agent SDK integration
└── prompts/
    ├── index.ts           # Prompt routing
    ├── orchestrator.ts    # Orchestrator instructions
    ├── discovery.ts       # Discovery instructions
    ├── coverage.ts        # Coverage instructions
    ├── enhancement.ts     # Enhancement instructions
    ├── migration.ts       # Migration instructions
    └── validation.ts      # Validation instructions
```

### State Files

The `.modernization/` directory contains:

| File | Description |
|------|-------------|
| `state.json` | Overall project state, progress, and session history |
| `functionality_map.json` | Discovery results: features, dependencies, architecture |
| `test_coverage.json` | Coverage analysis and test generation queue |
| `enhancement_plan.json` | Enhancement implementation plan |
| `migration_plan.json` | Migration strategy and feature mapping |
| `sessions/` | Individual session transcripts |

## Configuration

### Agent Models

Different agents use different Claude models optimized for their tasks:

| Agent | Default Model | Reasoning |
|-------|---------------|-----------|
| Orchestrator | opus | Complex decision making |
| Discovery | opus | Deep analysis required |
| Coverage | sonnet | Test generation |
| Enhancement | sonnet | Code modification |
| Migration | opus | Complex translation |
| Validation | haiku | Quick validation checks |

Override with the `--model` flag:
```bash
modernize discover /path/to/project --model sonnet
```

### Coverage Targets

Set custom coverage targets:
```bash
modernize coverage /path/to/project --target 90
```

## Security

The Modernization Agent implements defense-in-depth security:

### Command Allowlist

Only approved commands can be executed:
- Read operations: `ls`, `cat`, `grep`, `find`, `git status`, etc.
- Build/test: `npm run`, `npm test`, `pytest`, `vitest`, etc.
- Code analysis: `eslint`, `prettier`, `tsc`, etc.

### Blocked Patterns

Dangerous operations are blocked:
- Destructive: `rm -rf /`, `dd if=`, fork bombs
- Network exfiltration: piped curl/wget to shell
- Privilege escalation: `sudo`, `chmod 777`
- Git dangerous: `git push --force`, `git reset --hard`

### Approval Gates

High-risk operations require explicit approval before execution:
- `rm` - File deletion
- `kill` - Process termination
- Database modifications (`DELETE FROM`, `UPDATE...SET`, `ALTER TABLE`)

Note: `git push` is blocked entirely (not in allowlist) to prevent accidental pushes. Force push operations (`git push --force`) are blocked as dangerous patterns.

### Mode-Specific Adjustments

| Mode | Additional Restrictions |
|------|------------------------|
| Discovery | Read-only, blocks all write operations |
| Coverage | Allows test file creation |
| Enhancement | Allows code modifications |
| Migration | Requires approval for dependency changes |

## API Reference

### Programmatic Usage

```typescript
import {
  runOrchestrator,
  loadState,
  runDiscovery,
  checkAuthentication,
} from '@anthropic/modernization-agent';

// Check authentication
const auth = checkAuthentication();
if (!auth.authenticated) {
  console.error(auth.error);
  process.exit(1);
}

// Run discovery
const map = await runDiscovery('/path/to/project', (msg) => {
  console.log(msg);
});

// Run orchestrator
const result = await runOrchestrator({
  projectDir: '/path/to/project',
  mode: 'coverage',
  model: 'sonnet',
});
```

### Key Exports

```typescript
// State Management
export { loadState, saveState, createInitialState } from './state';

// Discovery
export { runDiscovery, detectLanguage, detectFramework } from './agents/discovery';

// Security
export { validateCommand, isPathSafe, sanitizeOutput } from './security';

// Orchestrator
export { runOrchestrator, determineNextAgent } from './agents/orchestrator';

// Runner
export { runAgentSession, checkAuthentication } from './agents/runner';
```

## Development

### Setup

```bash
git clone https://github.com/anthropics/modernization-agent.git
cd modernization-agent
npm install
```

### Build

```bash
npm run build      # Compile TypeScript
npm run dev        # Watch mode
```

### Test

```bash
npm test           # Run tests
npm run test:coverage  # Run with coverage
```

### Lint

```bash
npm run lint       # Run ESLint
```

### Project Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run dev` | Watch mode for development |
| `npm run start` | Run the CLI |
| `npm test` | Run tests with Vitest |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run clean` | Remove dist directory |

## Supported Technologies

### Languages

| Language | Extensions | Markers |
|----------|------------|---------|
| TypeScript | `.ts`, `.tsx` | `tsconfig.json` |
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` | `package.json` |
| Python | `.py` | `requirements.txt`, `pyproject.toml` |
| Go | `.go` | `go.mod` |
| Rust | `.rs` | `Cargo.toml` |
| Java | `.java` | `pom.xml`, `build.gradle` |
| Ruby | `.rb` | `Gemfile` |
| PHP | `.php` | `composer.json` |

### Frameworks

| Framework | Language | Detection |
|-----------|----------|-----------|
| Vue | TypeScript | `vue` dependency |
| Nuxt | TypeScript | `nuxt`, `nuxt3`, `@nuxt/kit` |
| React | TypeScript | `react`, `react-dom` |
| Angular | TypeScript | `@angular/core` |
| Next.js | TypeScript | `next` |
| NestJS | TypeScript | `@nestjs/core` |
| Express | TypeScript | `express` |
| Django | Python | `django` |
| Flask | Python | `flask` |
| FastAPI | Python | `fastapi` |
| Gin | Go | `gin-gonic/gin` |
| Actix | Rust | `actix-web` |
| Spring | Java | `spring-boot` |
| Rails | Ruby | `rails` |

## License

MIT License - see [LICENSE](LICENSE) for details.
