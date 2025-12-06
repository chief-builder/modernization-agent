# API Reference

This document provides detailed API documentation for the Modernization Agent system.

## Table of Contents

- [Core Types](#core-types)
- [State Management](#state-management)
- [Discovery Module](#discovery-module)
- [Orchestrator Module](#orchestrator-module)
- [Runner Module](#runner-module)
- [Security Module](#security-module)
- [Prompts Module](#prompts-module)

---

## Core Types

### Operation Modes

```typescript
type OperationMode = 'discovery' | 'coverage' | 'enhancement' | 'migration';
```

### Agent Types

```typescript
type AgentType =
  | 'orchestrator'
  | 'discovery'
  | 'coverage'
  | 'enhancement'
  | 'migration'
  | 'validation';
```

### ModernizationState

The main state object that tracks all modernization progress.

```typescript
interface ModernizationState {
  version: string;
  projectPath: string;
  projectName: string;
  mode: OperationMode;
  currentPhase: string;
  sessionNumber: number;
  createdAt: string;
  updatedAt: string;

  // Discovery state
  discoveryComplete: boolean;
  functionalityMap?: FunctionalityMap;

  // Coverage state
  coverageTarget: number;
  currentCoverage: number;
  testCoverageMap?: TestCoverageMap;

  // Enhancement state
  enhancementSpec?: string;
  enhancementPlan?: EnhancementPlan;

  // Migration state
  sourceStack?: TechStack;
  targetStack?: TechStack;
  migrationPlan?: MigrationPlan;
  featuresMigrated: number;
  featuresTotal: number;

  // Session history
  sessions: SessionSummary[];

  // Approval gates
  pendingApprovals: ApprovalRequest[];
}
```

### FunctionalityMap

The output of discovery mode containing all analyzed features.

```typescript
interface FunctionalityMap {
  version: string;
  discoveredAt: string;
  sourceAnalysis: SourceAnalysis;
  features: Feature[];
  undocumentedBehaviors: UndocumentedBehavior[];
  externalDependencies: ExternalDependency[];
  databaseSchema?: DatabaseSchema;
}

interface SourceAnalysis {
  language: string;
  languageVersion?: string;
  framework?: string;
  frameworkVersion?: string;
  entryPoints: EntryPoint[];
  totalFiles: number;
  totalLines: number;
  architecturePattern?: string;
}

interface Feature {
  id: string;
  name: string;
  category: string;
  description?: string;
  discoveryMethod: 'static' | 'runtime' | 'static+runtime';
  sourceLocations: SourceLocation[];
  apiEndpoints?: APIEndpoint[];
  uiComponents?: UIComponent[];
  dependencies: string[];
  testCoverage?: FeatureTestCoverage;
  complexity?: 'low' | 'medium' | 'high';
  priority?: number;
}
```

### AgentConfig

Configuration passed to agent execution.

```typescript
interface AgentConfig {
  projectDir: string;
  mode: OperationMode;
  model: 'opus' | 'sonnet' | 'haiku';
  maxIterations?: number;
  specFile?: string;
  targetStack?: string;
  dryRun?: boolean;
  verbose?: boolean;
}
```

### SessionResult

Result returned from agent execution.

```typescript
interface SessionResult {
  shouldContinue: boolean;
  error?: string;
  artifactsCreated?: string[];
  artifactsModified?: string[];
}
```

---

## State Management

**Module:** `src/state.ts`

### initializeModernizationDir

Initialize the `.modernization/` directory structure.

```typescript
async function initializeModernizationDir(projectDir: string): Promise<void>
```

**Parameters:**
- `projectDir` - Absolute path to the project directory

**Example:**
```typescript
await initializeModernizationDir('/path/to/project');
// Creates .modernization/ and .modernization/sessions/
```

### isInitialized

Check if a project has been initialized.

```typescript
async function isInitialized(projectDir: string): Promise<boolean>
```

**Parameters:**
- `projectDir` - Absolute path to the project directory

**Returns:** `true` if `.modernization/state.json` exists

### createInitialState

Create a new state object for a project.

```typescript
function createInitialState(
  projectDir: string,
  projectName: string,
  mode: OperationMode
): ModernizationState
```

**Parameters:**
- `projectDir` - Absolute path to the project
- `projectName` - Human-readable project name
- `mode` - Initial operation mode

**Returns:** New `ModernizationState` object

### loadState / saveState

Load and save state from disk.

```typescript
async function loadState(projectDir: string): Promise<ModernizationState | null>
async function saveState(projectDir: string, state: ModernizationState): Promise<void>
```

### Artifact Management

```typescript
// Functionality map
async function loadFunctionalityMap(projectDir: string): Promise<FunctionalityMap | null>
async function saveFunctionalityMap(projectDir: string, map: FunctionalityMap): Promise<void>

// Test coverage
async function loadTestCoverageMap(projectDir: string): Promise<TestCoverageMap | null>
async function saveTestCoverageMap(projectDir: string, map: TestCoverageMap): Promise<void>

// Enhancement plan
async function loadEnhancementPlan(projectDir: string): Promise<EnhancementPlan | null>
async function saveEnhancementPlan(projectDir: string, plan: EnhancementPlan): Promise<void>

// Migration plan
async function loadMigrationPlan(projectDir: string): Promise<MigrationPlan | null>
async function saveMigrationPlan(projectDir: string, plan: MigrationPlan): Promise<void>
```

### Session Management

```typescript
function createSessionSummary(
  sessionNumber: number,
  agentType: AgentType
): SessionSummary

function completeSessionSummary(
  summary: SessionSummary,
  operations: string[],
  artifacts: string[],
  nextActions: string[],
  errors?: string[]
): void

function addSessionSummary(state: ModernizationState, summary: SessionSummary): void
```

### Approval Management

```typescript
function addApprovalRequest(
  state: ModernizationState,
  request: Omit<ApprovalRequest, 'id' | 'requestedAt' | 'status'>
): string  // Returns approval ID

function resolveApproval(
  state: ModernizationState,
  approvalId: string,
  approved: boolean,
  approvedBy?: string
): boolean  // Returns true if found

function getPendingApprovals(state: ModernizationState): ApprovalRequest[]
```

### Progress Tracking

```typescript
function markDiscoveryComplete(state: ModernizationState): void
function updateCoverageMetrics(state: ModernizationState, currentCoverage: number): void
function updateMigrationProgress(state: ModernizationState, featuresMigrated: number, featuresTotal: number): void
```

---

## Discovery Module

**Module:** `src/agents/discovery.ts`

### runDiscovery

Run the complete discovery process on a project.

```typescript
async function runDiscovery(
  projectDir: string,
  onProgress?: (message: string) => void
): Promise<FunctionalityMap>
```

**Parameters:**
- `projectDir` - Absolute path to the project
- `onProgress` - Optional callback for progress updates

**Returns:** Complete `FunctionalityMap` with all discovered features

**Example:**
```typescript
const map = await runDiscovery('/path/to/project', (msg) => {
  console.log(`Discovery: ${msg}`);
});
console.log(`Found ${map.features.length} features`);
```

### detectLanguage

Detect the primary programming language.

```typescript
async function detectLanguage(projectDir: string): Promise<string>
```

**Returns:** Language name (e.g., 'typescript', 'python', 'go') or 'unknown'

### detectFramework

Detect the framework used in the project.

```typescript
async function detectFramework(projectDir: string): Promise<string | undefined>
```

**Returns:** Framework name (e.g., 'vue', 'react', 'express') or undefined

**Note:** Checks workspace packages in monorepos for more accurate detection.

### detectArchitecturePattern

Detect the architecture pattern.

```typescript
async function detectArchitecturePattern(projectDir: string): Promise<string>
```

**Returns:** 'monorepo', 'layered', or 'modular'

### findWorkspacePackages

Find all packages in a monorepo.

```typescript
async function findWorkspacePackages(projectDir: string): Promise<string[]>
```

**Returns:** Array of relative paths to workspace packages

**Supports:**
- npm/yarn workspaces (package.json)
- pnpm workspaces (pnpm-workspace.yaml)

### findEntryPoints

Find all entry points in a project.

```typescript
async function findEntryPoints(
  projectDir: string,
  language: string
): Promise<EntryPoint[]>
```

**Sources:**
- package.json fields: main, module, bin, exports
- Common patterns: src/index.ts, main.py, etc.

### extractDependencies

Extract all dependencies from package.json.

```typescript
async function extractDependencies(projectDir: string): Promise<ExternalDependency[]>
```

**Returns:** Array of dependencies with type (production, development, peer)

### Feature Utilities

```typescript
// Create a new feature
function createFeature(
  name: string,
  path: string,
  lines: [number, number],
  discoveryMethod?: 'static' | 'runtime' | 'static+runtime'
): Feature

// Calculate feature complexity
function calculateComplexity(feature: Feature): 'low' | 'medium' | 'high'

// Prioritize features for testing/migration
function prioritizeFeatures(map: FunctionalityMap): FunctionalityMap

// Generate a discovery report
function generateDiscoveryReport(map: FunctionalityMap): string
```

---

## Orchestrator Module

**Module:** `src/agents/orchestrator.ts`

### runOrchestrator

Main entry point for running the modernization workflow.

```typescript
async function runOrchestrator(config: AgentConfig): Promise<SessionResult>
```

**Parameters:**
- `config` - Agent configuration including project path, mode, and model

**Returns:** Session result indicating whether to continue

**Example:**
```typescript
const result = await runOrchestrator({
  projectDir: '/path/to/project',
  mode: 'discovery',
  model: 'opus',
});

if (result.error) {
  console.error(result.error);
} else if (result.shouldContinue) {
  console.log('Run continue to proceed');
}
```

### initializeProject

Initialize a new modernization project.

```typescript
async function initializeProject(
  projectDir: string,
  mode: OperationMode,
  options?: {
    targetStack?: string;
    enhancementSpec?: string;
    coverageTarget?: number;
  }
): Promise<ModernizationState>
```

### determineNextAgent

Determine which agent should run based on current state.

```typescript
function determineNextAgent(
  state: ModernizationState,
  mode: OperationMode
): AgentType
```

**Logic:**
- Checks for pending approvals first
- Discovery mode: Returns 'discovery' if not complete
- Coverage mode: Returns 'discovery' → 'coverage' → 'validation'
- Enhancement mode: Returns 'discovery' → 'enhancement' → 'validation'
- Migration mode: Returns 'discovery' → 'coverage' → 'migration' → 'validation'

### getModelForAgent

Get the recommended model for an agent type.

```typescript
function getModelForAgent(agentType: AgentType): 'opus' | 'sonnet' | 'haiku'
```

**Returns:**
- 'opus' for orchestrator, discovery, migration
- 'sonnet' for coverage, enhancement
- 'haiku' for validation

### calculateProgress

Calculate progress percentage.

```typescript
function calculateProgress(state: ModernizationState): number
```

### generateStatusReport

Generate a human-readable status report.

```typescript
function generateStatusReport(state: ModernizationState): string
```

### buildAgentContext

Build context string for a specialized agent.

```typescript
async function buildAgentContext(
  state: ModernizationState,
  agentType: AgentType,
  config: AgentConfig
): Promise<string>
```

---

## Runner Module

**Module:** `src/agents/runner.ts`

### checkAuthentication

Check if authentication is configured.

```typescript
function checkAuthentication(): {
  authenticated: boolean;
  method?: 'oauth' | 'api_key';
  error?: string;
}
```

**Environment Variables:**
- `CLAUDE_CODE_OAUTH_TOKEN` - OAuth token for Claude MAX subscribers
- `ANTHROPIC_API_KEY` - API key for direct API access

### runAgentSession

Run an agent session using Claude Agent SDK.

```typescript
async function runAgentSession(
  agentType: AgentType,
  state: ModernizationState,
  config: AgentConfig,
  onProgress?: (message: string) => void
): Promise<SessionResult>
```

**Parameters:**
- `agentType` - Type of agent to run
- `state` - Current modernization state
- `config` - Agent configuration
- `onProgress` - Optional progress callback

**Example:**
```typescript
const result = await runAgentSession(
  'coverage',
  state,
  config,
  (msg) => console.log(msg)
);
```

---

## Security Module

**Module:** `src/security.ts`

### validateCommand

Validate a bash command for security.

```typescript
function validateCommand(
  command: string,
  config?: SecurityConfig
): CommandValidation

interface CommandValidation {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
}
```

**Example:**
```typescript
const result = validateCommand('rm -rf /');
// { allowed: false, reason: 'Command matches blocked pattern: rm -rf /' }

const result2 = validateCommand('git push origin main');
// { allowed: true, requiresApproval: true, reason: 'Command requires approval: git push' }

const result3 = validateCommand('npm test');
// { allowed: true }
```

### getSecurityConfigForMode

Get security config adjusted for operation mode.

```typescript
function getSecurityConfigForMode(
  mode: OperationMode,
  baseConfig?: SecurityConfig
): SecurityConfig
```

**Mode Adjustments:**
- Discovery: Adds write operations to approval list
- Coverage: No additional restrictions
- Enhancement: No additional restrictions
- Migration: Adds package install to approval list

### isPathSafe

Check if a file path is safe to access.

```typescript
function isPathSafe(path: string, projectDir: string): boolean
```

**Blocks:**
- Absolute paths outside project (except /tmp)
- Path traversal outside project
- Sensitive paths: /etc/, .ssh/, .aws/, .env, credentials

### sanitizeOutput

Remove sensitive information from output.

```typescript
function sanitizeOutput(output: string): string
```

**Redacts:**
- API keys and tokens
- AWS credentials
- Private keys
- Connection strings

---

## Prompts Module

**Module:** `src/prompts/index.ts`

### getPromptForAgent

Get the appropriate prompt for an agent type.

```typescript
function getPromptForAgent(agentType: AgentType, state: ModernizationState): string
```

### Individual Prompt Functions

```typescript
function getOrchestratorPrompt(state: ModernizationState): string
function getDiscoveryPrompt(state: ModernizationState): string
function getCoveragePrompt(state: ModernizationState): string
function getEnhancementPrompt(state: ModernizationState): string
function getMigrationPrompt(state: ModernizationState): string
function getValidationPrompt(state: ModernizationState): string
```

---

## Constants

### Language Patterns

```typescript
const LANGUAGE_PATTERNS: Record<string, { extensions: string[]; markers: string[] }> = {
  typescript: { extensions: ['.ts', '.tsx'], markers: ['tsconfig.json', 'package.json'] },
  javascript: { extensions: ['.js', '.jsx', '.mjs', '.cjs'], markers: ['package.json'] },
  python: { extensions: ['.py'], markers: ['requirements.txt', 'setup.py', 'pyproject.toml'] },
  go: { extensions: ['.go'], markers: ['go.mod', 'go.sum'] },
  rust: { extensions: ['.rs'], markers: ['Cargo.toml'] },
  java: { extensions: ['.java'], markers: ['pom.xml', 'build.gradle'] },
  ruby: { extensions: ['.rb'], markers: ['Gemfile', 'Rakefile'] },
  php: { extensions: ['.php'], markers: ['composer.json'] },
};
```

### Framework Patterns

```typescript
const FRAMEWORK_PATTERNS: Record<string, { language: string; markers: string[] }> = {
  nuxt: { language: 'typescript', markers: ['nuxt', 'nuxt3', '@nuxt/kit'] },
  vue: { language: 'typescript', markers: ['vue', '@vue/cli-service'] },
  react: { language: 'typescript', markers: ['react', 'react-dom'] },
  nextjs: { language: 'typescript', markers: ['next'] },
  // ... more frameworks
};
```

### Feature Categories

```typescript
const FEATURE_CATEGORY_PATTERNS: Record<string, string[]> = {
  authentication: ['auth', 'login', 'logout', 'signin', 'signup', 'session', 'jwt', 'oauth'],
  api: ['api', 'endpoint', 'route', 'controller', 'handler', 'rest', 'graphql'],
  database: ['model', 'schema', 'migration', 'repository', 'dao', 'entity', 'query'],
  ui: ['component', 'view', 'page', 'template', 'layout', 'widget'],
  // ... more categories
};
```
