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
  determinePromptType,
  Assignment,
  Job,
  JobGroup,
  ChatJobContext,
} from './prompts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');
const TEST_TEMPLATE_PATH = join(TEMPLATES_DIR, '_test-scenario.md');

const BLOCK_ASSESSMENT_SECTION = `## ASSIGNMENT BLOCKED — STEWARD ASSESSMENT

Outcome🧭Steward — assignment {{ASSIGNMENT_ID}} has been blocked by its PM.
Reason on record: {{BLOCKED_REASON}}

A PM blocks only when a decision cannot be inferred from the north star plus
Mental Model with high confidence. Assess whether the block is warranted.
For each open question, give your recommended answer and the Mental Model or
conversation evidence behind it. Separate what you can answer from what only
the user can decide.

Respond with a tight **executive summary** and **a recommended resolution**.
This is advisory — the user is the only resolver of a Block. Do not resume
the assignment. Resuming is a cook move: once the user confirms, set the
answers as a nudge and insert a pm job. Unblock if the user asks.

### Blocking PM message
\`\`\`
{{LATEST_MESSAGE}}
\`\`\``;

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
    groupId: 'group_789',
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
  const mode = overrides.mode ?? 'jam';
  const effectivePromptMode =
    overrides.effectivePromptMode ?? (mode === 'guardian' ? 'cook' : mode);

  return {
    threadId: 'thread_123',
    namespaceId: 'ns_xyz',
    mode,
    effectivePromptMode,
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

    const prompt = buildPrompt(group, assignment, job, [], [], []);

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

    const prompt = buildPrompt(group, assignment, job, [], [
      { jobType: 'implement', harness: 'claude', result: previousResult },
    ], []);

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

    const prompt = buildPrompt(group, assignment, job, [], [
      { jobType: 'implement', harness: 'claude', result: previousResult },
    ], []);

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

  it('scenario: block-assessment template preserves the supplied section exactly', () => {
    const template = loadTemplate('product-owner');
    assert.ok(template.includes(`{{#section BLOCK_ASSESSMENT}}\n${BLOCK_ASSESSMENT_SECTION}\n{{/section}}`));
    const section = template.match(/\{\{#section BLOCK_ASSESSMENT\}\}([\s\S]*?)\{\{\/section\}\}/)?.[1];
    assert.ok(section);
    assert.ok(section.includes('{{ASSIGNMENT_ID}}'));
    assert.doesNotMatch(section, /\b[a-z0-9]{32}\b/);
  });

  for (const mode of ['jam', 'cook', 'guardian'] as const) {
    for (const session of [
      { name: 'resumed session', claudeSessionId: 'session_existing', forkSession: false },
      { name: 'first fork', claudeSessionId: 'session_original', forkSession: true },
      { name: 'fresh session', claudeSessionId: undefined, forkSession: false },
    ]) {
      for (const isGuardianEvaluation of [false, true]) {
        it(`scenario: block assessment wins in ${mode}, ${session.name}, evaluation=${isGuardianEvaluation}`, () => {
          const pmReport = 'PM BLOCKED: Which direction should the user choose?\nEvidence remains unresolved.';
          const blockedReason = 'North star conflicts with the user’s latest decision.\nNeeds user resolution.';
          const context = mockChatContext({
            mode,
            claudeSessionId: session.claudeSessionId,
            forkSession: session.forkSession,
            isThreadFork: true,
            assignmentId: 'asgn_other',
            latestUserMessage: pmReport,
            blockedReason,
            isBlockAssessment: true,
            isGuardianEvaluation,
            checkpoint: { round: 1, completionReviews: 3, chainShape: 'R+D M' },
          });
          assert.strictEqual(determinePromptType(context), 'block_assessment');
          const prompt = buildChatPrompt(context, 'my-project');
          assert.strictEqual(prompt, BLOCK_ASSESSMENT_SECTION
            .replace('{{ASSIGNMENT_ID}}', () => context.assignmentId!)
            .replace('{{BLOCKED_REASON}}', () => blockedReason)
            .replace('{{LATEST_MESSAGE}}', () => pmReport));
          assert.ok(prompt.includes(`assignment ${context.assignmentId} has been blocked by its PM.`));
          assert.strictEqual(prompt.split(pmReport).length - 1, 1);
          assert.strictEqual(prompt.split(blockedReason).length - 1, 1);
          assert.ok(!prompt.includes('**User says:**'));
          assert.ok(!/GUARDIAN MODE|JAM MODE|COOK MODE|Context Primer|FORKED THREAD|ASSIGNMENT COMPLETE/.test(prompt));
        });
      }
    }
  }

  it('scenario: blocking reason and PM report render verbatim without interpreting replacement tokens or placeholders', () => {
    const blockedReason = '  Reason: $& $$ $` $\' {{LATEST_MESSAGE}} {{ASSIGNMENT_ID}}\n  ';
    const pmReport = '  PM: $& $$ $` $\' {{BLOCKED_REASON}} {{CHECKPOINT_ROUND}} {{ASSIGNMENT_ID}}\n  ';
    const assignmentId = 'asgn_verbatim';
    const prompt = buildChatPrompt(mockChatContext({
      isBlockAssessment: true, blockedReason, latestUserMessage: pmReport, assignmentId,
    }), 'my-project');
    const expected = BLOCK_ASSESSMENT_SECTION
      .replace('{{ASSIGNMENT_ID}}', () => assignmentId)
      .replace(/\{\{(BLOCKED_REASON|LATEST_MESSAGE)\}\}/g,
        (_match, name: string) => name === 'BLOCKED_REASON' ? blockedReason : pmReport);
    assert.strictEqual(prompt, expected);
  });

  for (const assignmentId of [undefined, '']) {
    it(`scenario: block assessment without assignment ID ${JSON.stringify(assignmentId)} uses the linked-assignment fallback`, () => {
      const prompt = buildChatPrompt(mockChatContext({
        isBlockAssessment: true, assignmentId,
      }), 'my-project');
      assert.ok(prompt.includes('assignment (no assignment linked) has been blocked by its PM.'));
      assert.ok(!prompt.includes('{{ASSIGNMENT_ID}}'));
    });
  }

  it('scenario: an empty recorded block reason is preserved', () => {
    const prompt = buildChatPrompt(mockChatContext({
      isBlockAssessment: true, blockedReason: '',
    }), 'my-project');
    assert.ok(prompt.includes('Reason on record: \n\nA PM blocks'));
  });

  it('scenario: an older block context without a recorded reason remains renderable', () => {
    const prompt = buildChatPrompt(mockChatContext({ isBlockAssessment: true }), 'my-project');
    assert.ok(prompt.includes('Reason on record: (no reason recorded)'));
  });

  for (const overrides of [
    { mode: 'jam' as const },
    { mode: 'cook' as const, claudeSessionId: 'session_existing' },
    { mode: 'jam' as const, claudeSessionId: 'session_existing', lastPromptMode: 'jam' as const },
    { mode: 'jam' as const, claudeSessionId: 'session_existing', isThreadFork: true },
    { mode: 'guardian' as const, isGuardianEvaluation: true },
    { mode: 'guardian' as const, isCompletionSummary: true },
  ]) {
    it(`scenario: inactive block metadata leaves ${JSON.stringify(overrides)} unchanged`, () => {
      const context = mockChatContext(overrides);
      assert.strictEqual(buildChatPrompt(context, 'my-project'), buildChatPrompt({
        ...context, isBlockAssessment: false, blockedReason: 'Unrelated block metadata',
      }, 'my-project'));
      assert.ok(!buildChatPrompt(context, 'my-project').includes('ASSIGNMENT BLOCKED'));
    });
  }

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

  it('scenario: completion summary uses executive-assessment section', () => {
    const pmReport = 'All 3 work packages landed. Build green, 42 tests passing. Deployed to prod.';
    const context = mockChatContext({
      mode: 'cook',
      claudeSessionId: 'session_abc123', // resumes main thread session
      assignmentId: 'asgn_abc123',
      latestUserMessage: pmReport, // PM report carried as the trigger message
      isCompletionSummary: true,
    });

    const prompt = buildChatPrompt(context, 'my-project');

    // Uses the COMPLETION_SUMMARY section, not jam/cook mode prose
    assert.ok(prompt.includes('ASSIGNMENT COMPLETE'), 'Should use the executive-assessment section');
    assert.ok(prompt.includes('asgn_abc123'), 'Should inject the assignment id');

    // PM report present exactly once (not re-appended as a "User says" block)
    const occurrences = prompt.split(pmReport).length - 1;
    assert.strictEqual(occurrences, 1, 'PM report should appear exactly once');
    assert.ok(!prompt.includes('**User says:**'), 'Should not append a User says block');

    // No unreplaced placeholders
    assert.ok(!prompt.includes('{{LATEST_MESSAGE}}'), 'LATEST_MESSAGE should be replaced');
    assert.ok(!prompt.includes('{{ASSIGNMENT_ID}}'), 'ASSIGNMENT_ID should be replaced');
  });

  it('scenario: guardian checkpoint renders its round, review count, and chain shape', () => {
    const context = mockChatContext({
      mode: 'guardian',
      assignmentId: 'asgn_abc123',
      isGuardianEvaluation: true,
      checkpoint: { round: 2, completionReviews: 6, chainShape: 'P M I M R+R+R+D M' },
    });
    assert.strictEqual(determinePromptType(context), 'guardian_eval');
    const prompt = buildChatPrompt(context, 'my-project');
    assert.ok(prompt.includes('**Checkpoint round:** 2 · **Completion reviews:** 6'));
    assert.ok(prompt.includes('**Chain shape:** `P M I M R+R+R+D M`'));
    assert.ok(!/\{\{(?:CHECKPOINT_|COMPLETION_REVIEWS|CHAIN_SHAPE)/.test(prompt));
  });

  it('scenario: guardian evaluation without a checkpoint renders n/a metadata', () => {
    const prompt = buildChatPrompt(mockChatContext({
      mode: 'guardian', isGuardianEvaluation: true,
    }), 'my-project');
    assert.ok(prompt.includes('**Checkpoint round:** (n/a) · **Completion reviews:** (n/a)'));
    assert.ok(prompt.includes('**Chain shape:** `(n/a)`'));
    assert.ok(!/\{\{(?:CHECKPOINT_|COMPLETION_REVIEWS|CHAIN_SHAPE)/.test(prompt));
  });

  it('scenario: checkpoint metadata leaves a jam prompt byte-identical', () => {
    const context = mockChatContext({ mode: 'jam' });
    assert.strictEqual(buildChatPrompt(context, 'my-project'), buildChatPrompt({
      ...context, checkpoint: { round: 1, completionReviews: 3, chainShape: 'R+D M' },
    }, 'my-project'));
  });

  for (const session of [
    { name: 'existing guardian fork', claudeSessionId: 'guardian_session', forkSession: false },
    { name: 'first guardian fork', claudeSessionId: 'original_session', forkSession: true },
    { name: 'session-less guardian', claudeSessionId: undefined, forkSession: false },
  ]) {
    for (const isGuardianEvaluation of [false, true]) {
      it(`scenario: completion wins for ${session.name}, evaluation=${isGuardianEvaluation}`, () => {
        const pmReport = 'Final report: acceptance criteria verified; deployment remains owner-only.';
        const context = mockChatContext({
          mode: 'guardian',
          claudeSessionId: session.claudeSessionId,
          forkSession: session.forkSession,
          assignmentId: 'asgn_abc123',
          latestUserMessage: pmReport,
          isCompletionSummary: true,
          isGuardianEvaluation,
        });
        assert.strictEqual(determinePromptType(context), 'completion_summary');
        const prompt = buildChatPrompt(context, 'my-project');
        assert.ok(prompt.includes('ASSIGNMENT COMPLETE'));
        assert.ok(prompt.includes('asgn_abc123'));
        assert.strictEqual(prompt.split(pmReport).length - 1, 1);
        assert.ok(!prompt.includes('GUARDIAN MODE'));
        assert.ok(!prompt.includes('Alignment Response'));
        assert.ok(!prompt.includes('Context Primer'));
        assert.ok(!prompt.includes('**User says:**'));
        assert.ok(!/\{\{(?:CHECKPOINT_|COMPLETION_REVIEWS|CHAIN_SHAPE)/.test(prompt));
      });
    }
  }

  it('scenario: thread fork gets fork preamble + jam mode section', () => {
    const context = mockChatContext({
      mode: 'jam',
      threadId: 'thread_fork_456',
      claudeSessionId: 'session_from_parent', // inherited from parent thread
      isThreadFork: true,
      latestUserMessage: 'Let us explore the caching idea separately.',
    });

    const prompt = buildChatPrompt(context, 'my-project');

    // Fork preamble present, addressed to the NEW thread id
    assert.ok(prompt.includes('FORKED THREAD'), 'Should use the THREAD_FORK section');
    assert.ok(prompt.includes('thread_fork_456'), 'Should inject the new thread id');
    assert.ok(prompt.includes('chat-title'), 'Should instruct setting a title');

    // Jam mode section rides along (fork threads always open in jam)
    assert.ok(prompt.includes('JAM MODE'), 'Should include the jam mode section');

    // NOT the full initial prompt — the session already knows who it is
    assert.ok(!prompt.includes('Context Primer'), 'Should not resend the full initial prompt');

    // User message appended as usual
    assert.ok(prompt.includes('Let us explore the caching idea separately.'),
      'Should include the fork-opening message');
    assert.ok(!prompt.includes('{{THREAD_ID}}'), 'THREAD_ID should be replaced');
  });

  it('scenario: fork of a session-less thread degrades to full initial prompt', () => {
    const context = mockChatContext({
      mode: 'jam',
      claudeSessionId: undefined, // parent had no session to inherit
      isThreadFork: true,
    });

    const prompt = buildChatPrompt(context, 'my-project');

    // Fresh session takes priority: full prompt, no fork framing
    assert.ok(prompt.includes('Context Primer'), 'Should send the full initial prompt');
    assert.ok(!prompt.includes('FORKED THREAD'), 'Should not include fork preamble without a session');
  });
});
