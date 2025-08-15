# Codebase Reorganization Plan

**Analyst:** SophiaMatrix  
**Date:** 2025-08-15  
**Status:** Action Required

## Executive Summary

The codebase has accumulated significant organizational debt with 8 misplaced markdown files, 9 misplaced JavaScript test scripts, 6 duplicate quality gate reports, and an overly verbose README.md. These issues impact maintainability and developer experience.

## Critical Issues Identified

### 1. Misplaced Markdown Documentation (Root Directory)

**Current State:** 8 markdown files in project root that belong in docs/
- `EVENT_INDICATORS_TEST_REPORT.md` → Move to `docs/test-reports/`
- `GATE_VALIDATION_REPORT.md` → Move to `docs/test-reports/`
- `TIMELINE_BRANCH_FIX_VALIDATION.md` → Move to `docs/test-reports/`
- `data-flow-analysis.md` → Move to `docs/project/guides/architecture/`
- `quality-gate-report.md` → Move to `docs/test-reports/`
- `gate-decision-prompt-response-feature.md` → Move to `docs/project/guides/`

**Exception:** Keep `CLAUDE.md` in root (standard Claude Code configuration)

### 2. Misplaced JavaScript Test Scripts (Root Directory)

**Current State:** 9 JavaScript files in project root that belong in scripts/ or test directories

**Playwright Tests** → Moved to `scripts/tests/playwright/`:
- `scripts/tests/playwright/playwright-visual-test.js`
- `scripts/tests/playwright/playwright-ui-test.js`
- `scripts/tests/playwright/test-event-indicators-playwright.js`

**Screenshot/Capture Scripts** → Moved to `scripts/capture/`:
- `scripts/capture/capture-sessions-timeline.js`
- `scripts/capture/capture-timeline.js`

**Test Scripts** → Moved to `scripts/tests/`:
- `scripts/tests/test-batch-spacing.js`
- `scripts/tests/test-websocket-realtime.js`
- `scripts/tests/test-prompt-capture.js`
- `scripts/tests/test-prompt-response-ui.js`

### 3. Test HTML Files (Root Directory)

**Current State:** 2 HTML test files in root
- `scripts/tests/html/test-event-indicators.html`
- `scripts/tests/html/test-websocket-simple.html`

### 4. Duplicate Quality Gate Reports

**Current State:** 6 quality gate reports scattered across directories

**Duplicates Found:**
- `/quality-gate-report.md` (root)
- `/apps/client/quality-gate-report.md`
- `/docs/quality-gate-report.md`
- `/docs/quality-gate-auto-pan-test-report.md`
- `/docs/quality-gate-sessions-timeline-report.md`
- `/docs/sessions-ui-quality-gate-report.md`

**Recommendation:** 
- Consolidate into single `docs/test-reports/quality-gates/` directory
- Create subdirectories by feature or date
- Remove duplicates after verification

### 5. Client Test Files Organization

**Current State:** Test files scattered in apps/client/ root
- `apps/client/playwright-sessions-test.js`
- `apps/client/tests/playwright/playwright-visual-test.js`
- `apps/client/test-branch-fixes.js`
- `apps/client/test-virtual-scrolling.js`
- `apps/client/sessions-ui-validation.js`
- `apps/client/sessions-visual-validation.js`
- `apps/client/timeline-validation.spec.ts`

**Recommendation:** Move to `apps/client/tests/` with subdirectories:
- `apps/client/tests/playwright/`
- `apps/client/tests/unit/`
- `apps/client/tests/visual/`

### 6. README.md Optimization

**Current Issues:**
- 600+ lines (should be 150-200 max)
- Lines 452-597 duplicate earlier content
- Mixes installation, architecture, API documentation

**Recommended Structure:**
```markdown
# Project Name (30 lines)
## Overview & Demo
## Quick Start
## Key Features
## Documentation Links

Move detailed content to:
- docs/project/guides/installation.md
- docs/project/guides/architecture.md
- docs/project/guides/api-reference.md
```

### 7. App-Level README Files

**Current State:** Generic boilerplate content

**apps/client/README.md:**
- Generic Vue 3 + Vite template
- Should describe client-specific features

**apps/server/README.md:**
- Generic Bun init template
- Should describe server API and database

**apps/server/CLAUDE.md:**
- Bun-specific instructions
- Consider moving to docs/tech-docs/

## Proposed Directory Structure

```
claude-code-hooks-multi-agent-observability/
├── README.md (concise, 150-200 lines)
├── CLAUDE.md (keep in root)
├── apps/
│   ├── client/
│   │   ├── README.md (client-specific)
│   │   ├── src/
│   │   └── tests/
│   │       ├── playwright/
│   │       ├── unit/
│   │       └── visual/
│   └── server/
│       ├── README.md (server-specific)
│       └── src/
├── scripts/
│   ├── capture/
│   │   ├── capture-sessions-timeline.js
│   │   └── capture-timeline.js
│   ├── tests/
│   │   ├── playwright/
│   │   ├── html/
│   │   └── integration/
│   └── [existing scripts]
├── docs/
│   ├── project/
│   │   ├── guides/
│   │   │   ├── installation.md
│   │   │   ├── api-reference.md
│   │   │   └── [other guides]
│   │   └── [existing structure]
│   └── test-reports/
│       ├── quality-gates/
│       └── validation/
└── [other directories]
```

## Implementation Priority

### Phase 1: Critical Cleanup (Immediate)
1. Move all root-level test scripts to scripts/
2. Move all root-level markdown reports to docs/test-reports/
3. Consolidate duplicate quality gate reports

### Phase 2: README Optimization (High Priority)
1. Extract detailed content from README.md
2. Create focused documentation files
3. Update app-level READMEs with specific content

### Phase 3: Test Organization (Medium Priority)
1. Create test directory structures
2. Move client test files to organized subdirectories
3. Update import paths and scripts

## Impact Assessment

### Benefits
- **Improved Navigation:** Clear file organization
- **Reduced Confusion:** No duplicate reports
- **Better Maintenance:** Logical grouping of related files
- **Cleaner Root:** Only essential files in project root
- **Professional Structure:** Industry-standard organization

### Risks
- Import path updates needed
- Script references may break
- Git history fragmentation

### Mitigation
- Use git mv to preserve history
- Update all references systematically
- Test all scripts after moves
- Document new locations

## Success Metrics

- Zero test/documentation files in root directory
- README.md under 200 lines
- No duplicate documentation files
- All tests passing after reorganization
- Clear separation of concerns

## Next Steps

1. Review and approve this plan
2. Create backup/branch for safety
3. Execute Phase 1 cleanup
4. Verify all functionality
5. Proceed with subsequent phases

---

*This plan addresses all identified organizational issues while maintaining project functionality and improving developer experience.*