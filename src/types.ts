/**
 * Core types for the Autonomous Codebase Modernization Agent System
 */

// ============================================================================
// Operation Modes
// ============================================================================

export type OperationMode = 'discovery' | 'coverage' | 'enhancement' | 'migration';

export type AgentType =
  | 'orchestrator'
  | 'discovery'
  | 'coverage'
  | 'enhancement'
  | 'migration'
  | 'validation';

export type SessionType = 'initializer' | 'worker' | 'validator';

// ============================================================================
// State Management
// ============================================================================

export interface ModernizationState {
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

export interface SessionSummary {
  sessionNumber: number;
  agentType: AgentType;
  startedAt: string;
  completedAt?: string;
  durationMinutes?: number;
  operationsCompleted: string[];
  artifactsModified: string[];
  errors: string[];
  nextActions: string[];
}

export interface ApprovalRequest {
  id: string;
  operation: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
}

// ============================================================================
// Functionality Mapping (Use Case 1)
// ============================================================================

export interface FunctionalityMap {
  version: string;
  discoveredAt: string;
  sourceAnalysis: SourceAnalysis;
  features: Feature[];
  undocumentedBehaviors: UndocumentedBehavior[];
  externalDependencies: ExternalDependency[];
  databaseSchema?: DatabaseSchema;
}

export interface SourceAnalysis {
  language: string;
  languageVersion?: string;
  framework?: string;
  frameworkVersion?: string;
  entryPoints: EntryPoint[];
  totalFiles: number;
  totalLines: number;
  architecturePattern?: string;
}

export interface EntryPoint {
  file: string;
  function?: string;
  type: string;
}

export interface Feature {
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
  documentation?: FeatureDocumentation;
  behavioralNotes?: string[];
  complexity?: 'low' | 'medium' | 'high';
  priority?: number;
}

export interface SourceLocation {
  file: string;
  lines: [number, number];
  functions?: string[];
  classes?: string[];
}

export interface APIEndpoint {
  method: string;
  path: string;
  requestSchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  authRequired: boolean;
  documented: boolean;
}

export interface UIComponent {
  type: string;
  id?: string;
  screenshot?: string;
}

export interface FeatureTestCoverage {
  hasTests: boolean;
  testFiles: string[];
  testCount?: number;
  coveragePercent?: number;
}

export interface FeatureDocumentation {
  inlineDocs: boolean;
  readmeSection: boolean;
  apiDocs: boolean;
}

export interface UndocumentedBehavior {
  id: string;
  description: string;
  discoveredVia: 'runtime' | 'static';
  evidence?: string;
  affectedFeatures: string[];
}

export interface ExternalDependency {
  name: string;
  type: string;
  usedBy: string[];
  configLocation?: string;
}

export interface DatabaseSchema {
  tables: DatabaseTable[];
}

export interface DatabaseTable {
  name: string;
  columns: string[];
  relationships?: string[];
}

// ============================================================================
// Test Coverage (Use Case 2)
// ============================================================================

export interface TestCoverageMap {
  version: string;
  analyzedAt: string;
  overallCoverage: CoverageMetrics;
  byFeature: FeatureCoverage[];
  untestedFeatures: string[];
  generationQueue: TestGenerationTask[];
}

export interface CoverageMetrics {
  lineCoverage: number;
  branchCoverage: number;
  functionCoverage: number;
  previous?: CoverageMetrics;
}

export interface FeatureCoverage {
  featureId: string;
  featureName: string;
  coverage: CoverageMetrics;
  testFiles: string[];
  gaps: CoverageGap[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  testsGenerated: boolean;
}

export interface CoverageGap {
  file: string;
  uncoveredLines: number[];
  description: string;
  complexity: 'low' | 'medium' | 'high';
}

export interface TestGenerationTask {
  featureId: string;
  priority: number;
  estimatedTests: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

// ============================================================================
// Enhancement (Use Case 3)
// ============================================================================

export interface EnhancementPlan {
  version: string;
  createdAt: string;
  enhancementSpec: string;
  baselineTestResults: TestResults;
  enhancements: Enhancement[];
}

export interface Enhancement {
  id: string;
  title: string;
  description: string;
  affectedFeatures: string[];
  newFeatures: NewFeature[];
  implementationSteps: ImplementationStep[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresApproval: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface NewFeature {
  id: string;
  name: string;
  category: string;
}

export interface ImplementationStep {
  step: number;
  description: string;
  files: string[];
  risk: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
}

export interface TestResults {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

// ============================================================================
// Migration (Use Case 4)
// ============================================================================

export interface MigrationPlan {
  version: string;
  createdAt: string;
  strategy: 'strangler_fig' | 'big_bang' | 'parallel_running' | 'feature_flag';
  source: TechStack;
  target: TechStack;
  phases: MigrationPhase[];
  featureMigration: FeatureMigration[];
  dataMigration?: DataMigration;
  riskAssessment: RiskAssessment;
}

export interface TechStack {
  language: string;
  version: string;
  framework?: string;
  database?: string;
  keyDependencies: Dependency[];
}

export interface Dependency {
  name: string;
  version: string;
  equivalent?: string;
}

export interface MigrationPhase {
  phase: number;
  name: string;
  tasks?: string[];
  features?: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface FeatureMigration {
  featureId: string;
  featureName: string;
  sourceFiles: string[];
  targetFiles: string[];
  complexity: 'low' | 'medium' | 'high';
  dependencies: string[];
  migrationNotes?: string[];
  validationCriteria: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'validated';
  migratedAt?: string;
  validationResults?: ValidationResults;
}

export interface DataMigration {
  strategy: 'bulk_copy' | 'dual_write' | 'incremental';
  tables: TableMigration[];
}

export interface TableMigration {
  name: string;
  records: number;
  strategy: 'bulk_copy' | 'skip_historical' | 'transform';
}

export interface RiskAssessment {
  highRiskFeatures: string[];
  mitigationStrategies: string[];
}

export interface ValidationResults {
  behavioralTestsPassed: boolean;
  responseComparison: 'identical' | 'equivalent' | 'different';
  performance?: PerformanceComparison;
}

export interface PerformanceComparison {
  sourceP99Ms: number;
  targetP99Ms: number;
  improvement: string;
}

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AgentConfig {
  projectDir: string;
  mode: OperationMode;
  model: 'opus' | 'sonnet' | 'haiku';
  maxIterations?: number;
  specFile?: string;
  targetStack?: string;
  dryRun?: boolean;
  verbose?: boolean;
}

export interface SessionResult {
  shouldContinue: boolean;
  error?: string;
  artifactsCreated?: string[];
  artifactsModified?: string[];
}

// ============================================================================
// Security
// ============================================================================

export interface SecurityConfig {
  allowedCommands: string[];
  blockedPatterns: string[];
  requireApprovalFor: string[];
}

export interface CommandValidation {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
}
