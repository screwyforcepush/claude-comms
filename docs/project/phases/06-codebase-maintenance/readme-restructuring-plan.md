# README.md Restructuring Plan

## Current State Analysis

**File:** `/README.md`  
**Current Length:** 598 lines  
**Target Length:** 150-200 lines  
**Reduction Required:** 66-75%

## Identified Issues

1. **Duplicate Content**
   - Lines 129-196: Project structure (first occurrence)
   - Lines 453-497: Project structure (duplicate)
   - Lines 452-597: Largely duplicate earlier sections

2. **Overly Detailed Sections**
   - Lines 101-196: Full project structure (move to architecture guide)
   - Lines 197-287: Detailed event types (move to API reference)
   - Lines 288-451: Extended technical details (move to guides)

3. **Missing Navigation Focus**
   - No clear documentation hub structure
   - Mixed detail levels throughout
   - Installation mixed with architecture

## New README Structure (150-200 lines)

```markdown
# Claude Code Multi-Agent Observability & Communication System (Lines 1-5)

[Brief 2-3 sentence description]
[Link to demo video/screenshot]

## 🚀 Quick Start (Lines 6-20)

### Prerequisites
- Claude Code, Astral uv, Bun/npm
- API keys setup

### Installation (3 commands)
\`\`\`bash
git clone <repo>
./scripts/start-system.sh
# Open http://localhost:5173
\`\`\`

## 🎯 What This Does (Lines 21-40)

### Core Capabilities
1. **Observability**: Real-time agent monitoring
2. **Communication**: Inter-agent messaging  
3. **Visualization**: Timeline and dashboard views

### Key Features
- Hook event capture and storage
- Multi-agent coordination
- Real-time WebSocket updates
- Interactive timeline visualization

## 🏗️ Architecture Overview (Lines 41-60)

[Simple ASCII diagram]
\`\`\`
Agents → Hooks → Server → Database → Dashboard
           ↓
    Communication Bus
\`\`\`

**Tech Stack**: Vue 3, Bun, SQLite, WebSocket

## 📦 Project Integration (Lines 61-90)

### Add to Your Project
1. Copy `.claude` directory
2. Update `settings.json` 
3. Configure source-app name

### Basic Configuration
\`\`\`json
{
  "hooks": {
    "PreToolUse": [{...}]
  }
}
\`\`\`

## 📚 Documentation Hub (Lines 91-120)

### Getting Started
- [Installation Guide](docs/project/guides/installation.md)
- [Configuration](docs/project/guides/configuration.md)
- [Troubleshooting](docs/project/guides/troubleshooting.md)

### Technical Guides
- [Architecture Overview](docs/project/guides/architecture/system-overview.md)
- [API Reference](docs/project/guides/api-reference.md)
- [Hook Events](docs/project/guides/hook-events.md)
- [Agent Communication](docs/project/guides/agent-communication.md)

### Development
- [Contributing](CONTRIBUTING.md)
- [Development Setup](docs/project/guides/development.md)
- [Testing](docs/project/guides/testing.md)

## 🛠️ Common Commands (Lines 121-140)

| Command | Description |
|---------|-------------|
| `./scripts/start-system.sh` | Start server and client |
| `./scripts/reset-system.sh` | Clean reset |
| `./scripts/test-system.sh` | Run tests |
| `bun server` | Server only |
| `npm run dev` | Client only |

## 🔌 API Quick Reference (Lines 141-160)

### Key Endpoints
- `POST /api/events` - Submit events
- `GET /api/sessions` - List sessions
- `WS /ws` - Real-time updates

### Agent Communication
- `POST /api/agents/register` - Register agent
- `POST /api/messages` - Send message

[Full API Reference →](docs/project/guides/api-reference.md)

## 🤝 Contributing (Lines 161-175)

1. Fork the repository
2. Create feature branch
3. Follow code standards
4. Submit pull request

See [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License (Lines 176-180)

MIT License - See [LICENSE](LICENSE) file

## 🙏 Acknowledgments (Lines 181-190)

- Anthropic Claude Code team
- Contributors and testers
- Open source dependencies

---

**For detailed documentation, visit our [comprehensive guides](docs/project/guides/).**
```

## Content Migration Plan

### To Be Extracted

1. **Installation Details** → `docs/project/guides/installation.md`
   - Prerequisites details
   - Step-by-step setup
   - Environment variables
   - Troubleshooting

2. **Architecture Details** → `docs/project/guides/architecture/system-overview.md`
   - Component descriptions
   - Data flow diagrams
   - Technology choices
   - System design

3. **API Documentation** → `docs/project/guides/api-reference.md`
   - Full endpoint list
   - Request/response formats
   - WebSocket events
   - Event types table

4. **Project Structure** → `docs/project/guides/architecture/project-structure.md`
   - Full directory tree
   - File descriptions
   - Module organization

5. **Hook Configuration** → `docs/project/guides/hook-configuration.md`
   - Detailed settings.json
   - Hook types
   - Custom hooks

## Implementation Steps

### Step 1: Backup Current README
```bash
cp README.md README.md.backup
```

### Step 2: Extract Content Sections
1. Copy installation section to new guide
2. Copy architecture section to new guide
3. Copy API section to new guide
4. Copy configuration examples

### Step 3: Create New Guides
- Create installation.md with full setup details
- Create architecture/system-overview.md
- Create api-reference.md with complete API
- Create troubleshooting.md

### Step 4: Rewrite README
1. Start with new structure template
2. Add concise content for each section
3. Focus on navigation and quick start
4. Ensure all links work

### Step 5: Add Cross-References
- Link from README to detailed guides
- Add "Back to README" links in guides
- Create breadcrumb navigation

### Step 6: Validate
- Check all links work
- Verify no lost information
- Test quick start instructions
- Get team feedback

## Success Criteria

1. **Length**: 150-200 lines achieved
2. **Clarity**: New developer can start in <5 minutes
3. **Navigation**: All documentation easily discoverable
4. **Completeness**: No information lost, just reorganized
5. **Maintainability**: Clear separation of concerns

## Benefits After Restructuring

1. **Improved First Impression**: Clean, focused README
2. **Better Navigation**: Clear documentation hierarchy
3. **Faster Onboarding**: Quick start prominent
4. **Easier Maintenance**: Modular documentation
5. **Professional Appearance**: Industry-standard structure

## Rollback Plan

If issues discovered:
1. Restore from README.md.backup
2. Document specific problems
3. Revise approach
4. Re-implement with fixes

## Timeline

- **Hour 1**: Extract content to guides
- **Hour 2**: Create new guide files
- **Hour 3**: Rewrite README with new structure
- **Hour 4**: Validate links and test
- **Hour 5**: Team review and adjustments
- **Hour 6**: Final polish and commit