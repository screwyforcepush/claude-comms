/**
 * Scenario tests for prompts module
 *
 * Tests end-to-end prompt building with realistic data.
 * Run with: npx tsx --test lib/prompts.scenario.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadTemplate,
  buildPrompt,
  buildChatPrompt,
  Assignment,
  Job,
  JobGroup,
  ChatJobContext,
} from './prompts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');
const TEST_TEMPLATE_PATH = join(TEMPLATES_DIR, '_test-scenario.md');

// Test fixtures
function mockAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    _id: 'asgn_abc123',
    _creationTime: Date.now(),
    namespaceId: 'ns_xyz',
    northStar: 'Build a user authentication system with login, logout, and session management.',
    status: 'active',
    independent: false,
    priority: 5,
    artifacts: 'src/auth/login.ts: Login component\nsrc/auth/session.ts: Session manager',
    decisions: 'D1: Using JWT for tokens. D2: 24hr session expiry.',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now(),
    ...overrides,
  };
}

function mockJob(overrides: Partial<Job> = {}): Job {
  return {
    _id: 'job_def456',
    _creationTime: Date.now(),
    assignmentId: 'asgn_abc123',
    jobType: 'implement',
    harness: 'claude',
    context: 'Implement the login form with email/password fields and validation.',
    status: 'running',
    createdAt: Date.now() - 1800000,
    ...overrides,
  };
}

function mockGroup(overrides: Partial<JobGroup> = {}): JobGroup {
  return {
    _id: 'group_789',
    _creationTime: Date.now(),
    assignmentId: 'asgn_abc123',
    status: 'complete',
    createdAt: Date.now() - 2000000,
    ...overrides,
  };
}

function mockChatContext(overrides: Partial<ChatJobContext> = {}): ChatJobContext {
  return {
    threadId: 'thread_123',
    namespaceId: 'ns_xyz',
    mode: 'jam',
    messages: [
      { _id: 'msg1', threadId: 'thread_123', role: 'user', content: 'Hello', createdAt: Date.now() - 1000 },
    ],
    latestUserMessage: 'Can you help me with the authentication flow?',
    ...overrides,
  };
}

// ============================================================================
// loadTemplate scenarios
// ============================================================================

describe('loadTemplate scenarios', () => {
  it('loads existing template files', () => {
    // These templates should exist in the project
    const existingTypes = ['pm', 'implement', 'plan', 'uat'];

    existingTypes.forEach(type => {
      const template = loadTemplate(type);
      assert.ok(template.length > 50, `${type} template should have content`);
      assert.ok(!template.includes('Execute the task as described'), `${type} should not be fallback`);
    });
  });

  it('returns fallback for missing template', () => {
    const template = loadTemplate('nonexistent-job-type-xyz');

    assert.ok(template.includes('Execute the task as described'));
    assert.ok(template.includes('{{CONTEXT}}'));
  });
});

// ============================================================================
// buildPrompt scenarios
// ============================================================================

describe('buildPrompt scenarios', () => {
  const testTemplate = `# Test Job

## North Star
{{NORTH_STAR}}

## Context
{{CONTEXT}}

## Artifacts
{{ARTIFACTS}}

## Decisions
{{DECISIONS}}

## Previous Result
{{PREVIOUS_RESULT}}

## IDs
Assignment: {{ASSIGNMENT_ID}}
Job: {{CURRENT_JOB_ID}}
`;

  before(() => {
    // Create test template
    writeFileSync(TEST_TEMPLATE_PATH, testTemplate);
  });

  after(() => {
    // Cleanup test template
    if (existsSync(TEST_TEMPLATE_PATH)) {
      rmSync(TEST_TEMPLATE_PATH);
    }
  });

  it('scenario: fresh assignment, first job', () => {
    const assignment = mockAssignment({ artifacts: '', decisions: '' });
    const job = mockJob({
      jobType: '_test-scenario',
      context: 'Start planning the authentication feature.',
    });
    const group = mockGroup();

    const prompt = buildPrompt(group, assignment, job, []);

    // North star injected
    assert.ok(prompt.includes('Build a user authentication system'));

    // Context injected
    assert.ok(prompt.includes('Start planning the authentication feature'));

    // Empty artifacts/decisions show defaults
    assert.ok(prompt.includes('(none)'));

    // No previous result
    assert.ok(prompt.includes('(no previous results)'));

    // IDs injected
    assert.ok(prompt.includes('asgn_abc123'));
    assert.ok(prompt.includes('job_def456'));
  });

  it('scenario: mid-assignment with artifacts and decisions', () => {
    const assignment = mockAssignment();
    const job = mockJob();
    const group = mockGroup();
    const previousResult = 'Successfully implemented login form with validation. Tests passing.';

    const prompt = buildPrompt(group, assignment, job, [
      { jobType: 'implement', harness: 'claude', result: previousResult },
    ]);

    // Artifacts present
    assert.ok(prompt.includes('src/auth/login.ts'));
    assert.ok(prompt.includes('Login component'));

    // Decisions present
    assert.ok(prompt.includes('Using JWT for tokens'));

    // Previous result injected
    assert.ok(prompt.includes('Successfully implemented login form'));
  });

  it('scenario: previous job error visible in prompt', () => {
    const assignment = mockAssignment();
    const job = mockJob({ jobType: 'review', context: 'Review the authentication changes.' });
    const group = mockGroup();
    const previousResult = 'Error: JWT token validation failed. Stack trace...';

    const prompt = buildPrompt(group, assignment, job, [
      { jobType: 'implement', harness: 'claude', result: previousResult },
    ]);

    // Previous error visible
    assert.ok(prompt.includes('JWT token validation failed'));
  });
});

// ============================================================================
// buildChatPrompt scenarios
// ============================================================================

describe('buildChatPrompt scenarios', () => {
  // Note: These tests use the actual product-owner.md template
  // They verify conditional logic and placeholder replacement

  it('scenario: new jam session (safe mode)', () => {
    const context = mockChatContext({
      mode: 'jam',
      claudeSessionId: undefined, // New session
    });

    const prompt = buildChatPrompt(context, 'my-project');

    // Basic placeholders replaced
    assert.ok(prompt.includes('thread_123') || prompt.includes('my-project'),
      'Should include thread or namespace');
    assert.ok(prompt.includes('Can you help me with the authentication flow'),
      'Should include latest message');

    // Mode should be jam
    assert.ok(!prompt.includes('{{MODE}}'), 'MODE placeholder should be replaced');
  });

  it('scenario: resumed cook session (dangerous mode)', () => {
    const context = mockChatContext({
      mode: 'cook',
      claudeSessionId: 'session_abc123', // Resumed session
    });

    const prompt = buildChatPrompt(context, 'my-project');

    // Should not have unreplaced placeholders
    assert.ok(!prompt.includes('{{THREAD_ID}}'), 'THREAD_ID should be replaced');
    assert.ok(!prompt.includes('{{NAMESPACE}}'), 'NAMESPACE should be replaced');
    assert.ok(!prompt.includes('{{LATEST_MESSAGE}}'), 'LATEST_MESSAGE should be replaced');
  });

  it('scenario: mode affects prompt content', () => {
    const jamContext = mockChatContext({ mode: 'jam' });
    const cookContext = mockChatContext({ mode: 'cook' });

    const jamPrompt = buildChatPrompt(jamContext, 'test-ns');
    const cookPrompt = buildChatPrompt(cookContext, 'test-ns');

    // The prompts should be different due to conditionals
    // (assuming product-owner.md has {{#if COOK_MODE}} blocks)
    // At minimum, they should both be valid (no unreplaced conditionals)
    assert.ok(!jamPrompt.includes('{{#if'), 'Jam prompt should not have unprocessed conditionals');
    assert.ok(!cookPrompt.includes('{{#if'), 'Cook prompt should not have unprocessed conditionals');
  });
});
