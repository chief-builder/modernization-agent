# Contributing to Modernization Agent

Thank you for your interest in contributing to the Modernization Agent! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)
- [Adding New Features](#adding-new-features)

## Code of Conduct

Please be respectful and constructive in all interactions. We aim to foster an inclusive and welcoming community.

## Getting Started

### Prerequisites

- Node.js 20.0.0 or higher
- npm, pnpm, or yarn
- Git

### Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/modernization-agent.git
   cd modernization-agent
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Link for local testing:**
   ```bash
   npm link
   ```

5. **Run in development mode:**
   ```bash
   npm run dev  # Watches for changes and recompiles
   ```

## Project Structure

```
modernization-agent/
├── src/
│   ├── cli.ts                 # CLI entry point
│   ├── index.ts               # Public API exports
│   ├── types.ts               # TypeScript type definitions
│   ├── state.ts               # State persistence
│   ├── security.ts            # Security validation
│   ├── agents/
│   │   ├── orchestrator.ts    # Workflow coordination
│   │   ├── discovery.ts       # Codebase analysis
│   │   └── runner.ts          # Claude Agent SDK integration
│   └── prompts/
│       ├── index.ts           # Prompt routing
│       ├── orchestrator.ts    # Orchestrator prompt
│       ├── discovery.ts       # Discovery prompt
│       ├── coverage.ts        # Coverage prompt
│       ├── enhancement.ts     # Enhancement prompt
│       ├── migration.ts       # Migration prompt
│       └── validation.ts      # Validation prompt
├── docs/
│   └── API.md                 # API documentation
├── dist/                      # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
├── README.md
└── CONTRIBUTING.md
```

### Key Files

| File | Purpose |
|------|---------|
| `src/cli.ts` | CLI command definitions and handling |
| `src/types.ts` | All TypeScript interfaces and types |
| `src/state.ts` | State management and persistence |
| `src/security.ts` | Command validation and security |
| `src/agents/orchestrator.ts` | Main workflow coordination |
| `src/agents/discovery.ts` | Codebase analysis logic |
| `src/agents/runner.ts` | Claude Agent SDK integration |
| `src/prompts/*.ts` | Agent instruction prompts |

## Making Changes

### Branching Strategy

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes with clear, atomic commits

3. Push to your fork and create a pull request

### Commit Messages

Use clear, descriptive commit messages:

```
Add framework detection for Svelte

- Add svelte and sveltekit to FRAMEWORK_PATTERNS
- Update detectFramework to check for svelte.config.js
- Add tests for Svelte detection
```

**Format:**
- First line: Summary (50 chars or less)
- Blank line
- Body: Detailed explanation if needed

## Testing

### Running Tests

```bash
npm test              # Run all tests
npm run test:coverage # Run with coverage report
```

### Writing Tests

Tests use Vitest. Place test files alongside source files or in a `__tests__` directory:

```typescript
// src/agents/discovery.test.ts
import { describe, it, expect } from 'vitest';
import { detectLanguage, detectFramework } from './discovery';

describe('detectLanguage', () => {
  it('should detect TypeScript from tsconfig.json', async () => {
    const lang = await detectLanguage('/path/to/ts-project');
    expect(lang).toBe('typescript');
  });
});
```

### Test Coverage

We aim for high test coverage on critical paths:
- State management functions
- Security validation
- Discovery detection logic
- Command parsing

## Code Style

### TypeScript Guidelines

1. **Use explicit types** for function parameters and return values:
   ```typescript
   // Good
   function processFeature(feature: Feature): ProcessedFeature {
     // ...
   }

   // Avoid
   function processFeature(feature) {
     // ...
   }
   ```

2. **Use interfaces over type aliases** for object shapes:
   ```typescript
   // Preferred
   interface UserConfig {
     name: string;
     options: ConfigOptions;
   }

   // Use type for unions, intersections, mapped types
   type OperationMode = 'discovery' | 'coverage' | 'enhancement' | 'migration';
   ```

3. **Handle errors explicitly**:
   ```typescript
   // Good
   try {
     const data = await readFile(path, 'utf-8');
     return JSON.parse(data);
   } catch (error) {
     console.error('Failed to read file:', error);
     return null;
   }
   ```

4. **Use async/await** over raw promises:
   ```typescript
   // Good
   async function loadConfig() {
     const data = await readFile('config.json', 'utf-8');
     return JSON.parse(data);
   }

   // Avoid
   function loadConfig() {
     return readFile('config.json', 'utf-8').then(data => JSON.parse(data));
   }
   ```

### File Organization

1. **Imports** at the top, grouped by:
   - Node.js built-ins
   - External packages
   - Internal modules

2. **Exports** at the bottom or inline

3. **Constants** before functions

4. **Helper functions** before main functions

### Documentation

1. **JSDoc comments** for public functions:
   ```typescript
   /**
    * Detect the primary programming language of a project
    * @param projectDir - Absolute path to the project directory
    * @returns Language name or 'unknown'
    */
   export async function detectLanguage(projectDir: string): Promise<string> {
     // ...
   }
   ```

2. **Inline comments** for complex logic:
   ```typescript
   // Check workspace packages for framework dependencies
   // This handles monorepos where the framework is in a sub-package
   for (const workspace of workspaces) {
     // ...
   }
   ```

## Submitting Changes

### Pull Request Process

1. **Ensure all checks pass:**
   ```bash
   npm run build     # TypeScript compiles
   npm test          # Tests pass
   npm run lint      # No lint errors
   ```

2. **Update documentation** if adding features

3. **Create a pull request** with:
   - Clear title describing the change
   - Description of what and why
   - Any breaking changes noted
   - Related issues linked

### PR Template

```markdown
## Summary
Brief description of changes

## Changes
- List of specific changes
- New files added
- Existing files modified

## Testing
How the changes were tested

## Breaking Changes
Any breaking changes (or "None")
```

## Adding New Features

### Adding a New Language

1. Update `LANGUAGE_PATTERNS` in `src/agents/discovery.ts`:
   ```typescript
   const LANGUAGE_PATTERNS = {
     // ...existing languages
     kotlin: {
       extensions: ['.kt', '.kts'],
       markers: ['build.gradle.kts', 'settings.gradle.kts'],
     },
   };
   ```

2. Add entry point patterns in `ENTRY_POINT_PATTERNS`:
   ```typescript
   const ENTRY_POINT_PATTERNS = {
     // ...existing patterns
     kotlin: ['src/main/kotlin/**/Main.kt', 'src/main/kotlin/**/Application.kt'],
   };
   ```

3. Add tests for the new language

### Adding a New Framework

1. Update `FRAMEWORK_PATTERNS` in `src/agents/discovery.ts`:
   ```typescript
   const FRAMEWORK_PATTERNS = {
     // ...existing frameworks
     svelte: {
       language: 'typescript',
       markers: ['svelte', '@sveltejs/kit'],
     },
   };
   ```

2. Update framework detection order in `detectFramework()` if needed

3. Add tests for the new framework

### Adding a New CLI Command

1. Add command in `src/cli.ts`:
   ```typescript
   program
     .command('newcommand')
     .description('Description of the command')
     .argument('[project-path]', 'Path to the project', '.')
     .option('-o, --option <value>', 'Option description')
     .action(async (projectPath, options) => {
       await handleNewCommand(projectPath, options);
     });
   ```

2. Implement the handler function

3. Update README.md with usage documentation

### Adding Security Rules

1. For allowed commands, add to `allowedCommands` in `src/security.ts`

2. For blocked patterns, add to `blockedPatterns`

3. For approval-required operations, add to `requireApprovalFor`

4. Add tests for the new rules

### Modifying Agent Prompts

1. Edit the appropriate prompt file in `src/prompts/`

2. Prompts receive `ModernizationState` and can access:
   - Project information
   - Discovery results
   - Coverage metrics
   - Enhancement specs
   - Migration plans

3. Follow the existing prompt structure:
   - Clear objectives
   - Step-by-step process
   - Output format specification
   - Success criteria

## Questions?

If you have questions about contributing:

1. Check existing issues and discussions
2. Open a new issue for feature discussions
3. Ask in pull request comments for implementation questions

Thank you for contributing!
