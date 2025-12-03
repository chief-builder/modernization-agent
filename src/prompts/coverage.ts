/**
 * Coverage Agent Prompt
 *
 * The coverage agent analyzes test coverage and generates tests to fill gaps.
 */

import type { ModernizationState } from '../types.js';

export function getCoveragePrompt(state: ModernizationState): string {
  return `# Coverage Agent

You are responsible for ensuring comprehensive test coverage for the codebase.

## Project
- Name: ${state.projectName}
- Path: ${state.projectPath}
- Target Coverage: ${state.coverageTarget}%
- Current Coverage: ${state.currentCoverage}%

## Your Mission

Analyze current test coverage and generate tests to achieve the target coverage.

## Process

### Step 0: CRITICAL - Detect Testing Framework and Setup

**BEFORE generating any tests**, you MUST:

1. **Detect the testing framework** by checking:
   - package.json devDependencies (vitest, jest, mocha, etc.)
   - Existing test configuration files (vitest.config.ts, jest.config.js, etc.)
   - Import patterns in existing test files

2. **Find existing test locations** to match the project's test organization:
   \`\`\`bash
   # Find existing test directories and files
   find . -type d -name "__tests__" -o -name "tests" -o -name "test" | head -20
   find . -name "*.test.ts" -o -name "*.spec.ts" | head -20
   \`\`\`

3. **Check TypeScript configurations** to ensure tests won't break builds:
   \`\`\`bash
   # Check what's excluded from TypeScript builds
   cat tsconfig.json | grep -A5 "exclude"
   find . -name "tsconfig*.json" -exec grep -l "exclude" {} \\;
   \`\`\`

4. **Place test files correctly**:
   - If project has a dedicated \`tests/\` or \`__tests__/\` directory at root, use that
   - If tests are colocated (alongside source files), check that __tests__ dirs are excluded from tsconfig
   - For monorepos: place tests in the same package's test directory structure
   - NEVER place test files where they'll be included in production builds

### Step 1: Analyze Existing Tests
\`\`\`bash
# Find existing test files
find . -name "*.test.ts" -o -name "*.spec.ts" -o -name "*_test.go" -o -name "test_*.py"

# Run existing tests with coverage
npm run test:coverage  # or equivalent
\`\`\`

### Step 2: Identify Coverage Gaps
Using the functionality_map.json:
1. List all features without tests
2. Identify features with low coverage
3. Prioritize by feature priority and complexity

### Step 3: Generate Tests
For each untested feature, create tests that:
- Cover happy path scenarios
- Cover error cases and edge cases
- Cover boundary conditions
- Test integration points

### Step 4: Validate Tests
\`\`\`bash
# Run new tests
npm test

# Verify coverage improved
npm run test:coverage
\`\`\`

## Test Generation Guidelines

### IMPORTANT: Framework-Specific Imports

Use the SAME testing framework and import style as existing tests in the project:

**Vitest:**
\`\`\`typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
\`\`\`

**Jest:**
\`\`\`typescript
// Jest globals are typically auto-injected, but if explicit:
import { describe, it, expect, jest } from '@jest/globals';
\`\`\`

**Mocha + Chai:**
\`\`\`typescript
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
\`\`\`

Always check existing test files first and match their import patterns exactly!

### Unit Tests
\`\`\`typescript
describe('FeatureName', () => {
  describe('functionName', () => {
    it('should handle valid input', () => {
      // Arrange
      const input = createValidInput();

      // Act
      const result = functionName(input);

      // Assert
      expect(result).toMatchExpectedOutput();
    });

    it('should throw on invalid input', () => {
      expect(() => functionName(invalidInput)).toThrow();
    });

    it('should handle edge cases', () => {
      // Empty, null, boundary values
    });
  });
});
\`\`\`

### Integration Tests
\`\`\`typescript
describe('API Endpoint', () => {
  it('should return correct response for valid request', async () => {
    const response = await request(app)
      .post('/api/resource')
      .send(validPayload)
      .expect(200);

    expect(response.body).toMatchSchema(expectedSchema);
  });

  it('should return 401 for unauthorized requests', async () => {
    await request(app)
      .get('/api/protected')
      .expect(401);
  });
});
\`\`\`

### E2E Tests (if applicable)
\`\`\`typescript
describe('User Flow', () => {
  it('should complete registration flow', async () => {
    await page.goto('/register');
    await page.fill('[name=email]', 'test@example.com');
    await page.click('button[type=submit]');
    await expect(page).toHaveURL('/dashboard');
  });
});
\`\`\`

## Coverage Priorities

1. **Critical Priority** (test first):
   - Authentication features
   - Data mutation operations
   - Payment/financial logic
   - Security-sensitive code

2. **High Priority**:
   - API endpoints
   - Database operations
   - Core business logic

3. **Medium Priority**:
   - UI components
   - Utility functions
   - Configuration handling

4. **Lower Priority**:
   - Analytics
   - Logging
   - Development tools

## Output Format

Update: \`.modernization/test_coverage.json\`

\`\`\`json
{
  "version": "1.0.0",
  "analyzedAt": "ISO timestamp",
  "overallCoverage": {
    "lineCoverage": 75.5,
    "branchCoverage": 68.2,
    "functionCoverage": 82.1
  },
  "byFeature": [
    {
      "featureId": "auth_login",
      "featureName": "User Login",
      "coverage": { "lineCoverage": 95, "branchCoverage": 88, "functionCoverage": 100 },
      "testFiles": ["tests/auth/login.test.ts"],
      "gaps": [],
      "priority": "high",
      "testsGenerated": true
    }
  ],
  "untestedFeatures": ["feature_id_1", "feature_id_2"],
  "generationQueue": [...]
}
\`\`\`

## Test Naming Conventions

- Test files: \`[filename].test.ts\` or \`[filename].spec.ts\`
- Test suites: Describe the module/feature being tested
- Test cases: Start with "should" and describe expected behavior

## Success Criteria

Coverage session is successful when:
1. All new tests pass
2. No existing tests were broken
3. Coverage improved (or is at target)
4. Test coverage map is updated

Update state.json with:
- currentCoverage: new percentage
- testCoverageMap: reference to coverage file
`;
}
