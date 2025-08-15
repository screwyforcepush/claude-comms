# NPX Installer Bug Fix - Implementation Checklist

## Immediate Actions (Priority 1)

### BenjaminAura - GitHub Fetcher Fix
- [ ] Update `commonFiles` array in `_fetchWithRawUrls()` (lines 231-236)
  - Use complete file list from `complete-file-list.json`
  - Total: 20 files + CLAUDE.md
- [ ] Fix Trees API filtering logic (lines 179-181)
  - Ensure proper path matching for `.claude` directory
- [ ] Add validation method to check completeness
- [ ] Test all three fetch strategies

### ChloeMatrix - Installation Logic Enhancement
- [ ] Add completeness validation after fetch
- [ ] Implement proper error messages for incomplete fetches
- [ ] Ensure CLAUDE.md is always installed to root
- [ ] Clean up template system if using real fetcher

### AliceCortex - Bug Verification
- [ ] Test fix with rate-limited scenarios
- [ ] Verify all files are installed correctly
- [ ] Check file permissions preservation
- [ ] Document any edge cases found

## Enhancement Actions (Priority 2)

### Manifest-Based Fetching
- [ ] Create `.claude-manifest.json` in repository root
- [ ] Implement `_fetchWithManifest()` strategy
- [ ] Add to strategy chain before raw URLs

### Archive Download Strategy
- [ ] Implement `_fetchWithArchive()` using tarball/zipball
- [ ] Extract only needed files from archive
- [ ] Add as failover before static list

### Completeness Validation
- [ ] Create `_validateCompleteness()` method
- [ ] Check against required files list
- [ ] Report missing files clearly

## Testing Requirements

### Unit Tests
- [ ] Mock each fetch strategy
- [ ] Test fallback progression
- [ ] Validate error handling
- [ ] Check completeness validation

### Integration Tests
- [ ] Test against real GitHub API
- [ ] Simulate rate limiting
- [ ] Test network failures
- [ ] Verify complete installation

### E2E Tests
- [ ] Full npx installation flow
- [ ] Verify all 21 files present
- [ ] Check Python script permissions
- [ ] Test in clean environment

## Validation Criteria

### Files to Verify
```javascript
const REQUIRED_FILES = [
  // Core configuration
  '.claude/settings.json',
  '.claude/settings.local.json',
  
  // Agent definitions (9 files)
  '.claude/agents/core/agent-orchestrator.md',
  '.claude/agents/core/architect.md',
  '.claude/agents/core/business-analyst.md',
  '.claude/agents/core/deep-researcher.md',
  '.claude/agents/core/designer.md',
  '.claude/agents/core/engineer.md',
  '.claude/agents/core/gatekeeper.md',
  '.claude/agents/core/planner.md',
  '.claude/agents/meta-agent-builder.md',
  
  // Commands (2 files)
  '.claude/commands/cook.md',
  '.claude/commands/new-agents.md',
  
  // Communication hooks (4 files)
  '.claude/hooks/comms/get_unread_messages.py',
  '.claude/hooks/comms/register_subagent.py',
  '.claude/hooks/comms/send_message.py',
  '.claude/hooks/comms/update_subagent_completion.py',
  
  // Other hooks (2 files)
  '.claude/hooks/context/repo_map.py',
  '.claude/hooks/observability/send_event.py',
  
  // Root documentation
  'CLAUDE.md'
];
```

### Directory Structure
```
.claude/
├── agents/
│   ├── core/
│   │   ├── agent-orchestrator.md
│   │   ├── architect.md
│   │   ├── business-analyst.md
│   │   ├── deep-researcher.md
│   │   ├── designer.md
│   │   ├── engineer.md
│   │   ├── gatekeeper.md
│   │   └── planner.md
│   └── meta-agent-builder.md
├── commands/
│   ├── cook.md
│   └── new-agents.md
├── hooks/
│   ├── comms/
│   │   ├── get_unread_messages.py
│   │   ├── register_subagent.py
│   │   ├── send_message.py
│   │   └── update_subagent_completion.py
│   ├── context/
│   │   └── repo_map.py
│   ├── observability/
│   │   └── send_event.py
│   └── safety/
├── settings.json
└── settings.local.json
CLAUDE.md
```

## Performance Targets
- Installation time: < 30 seconds
- Memory usage: < 100MB
- Network requests: < 50 (with batching)
- Success rate: > 99%

## Error Messages
- Clear indication of what failed
- Actionable resolution steps
- Contact information for support
- Log file location for debugging