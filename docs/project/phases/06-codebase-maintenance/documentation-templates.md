# Documentation Templates for Multi-Agent Observability System

## Template Collection Overview

This collection provides standardized templates for all documentation types in our multi-agent observability system. Each template follows UX best practices for scannable content, clear navigation, and user-focused design.

## Template Usage Guidelines

### When to Use Each Template
- **README Template**: Main project entry points only
- **Guide Template**: Task-oriented instructions (installation, configuration, etc.)
- **Reference Template**: Comprehensive technical documentation (API, architecture)
- **Troubleshooting Template**: Problem-solving documentation
- **Phase Documentation**: Project phase planning and tracking

### Template Customization Rules
1. **Maintain Structure**: Keep required sections, customize content
2. **Preserve Navigation**: Always include breadcrumbs and cross-references
3. **Update Metadata**: Time estimates, prerequisites, difficulty level
4. **Test Usability**: Validate with actual users before publishing

---

## Template 1: README Navigation Hub

**Use Case**: Main project README files (root, apps/client, apps/server)
**Target Length**: 150-200 lines
**Focus**: Navigation and first impression

```markdown
# [Project Name] - [One-Line Mission Statement]

[2-3 sentence description that explains what this does and why it matters]

[Optional: Screenshot or demo GIF - max 800px width]

## 🚀 Quick Start

**Goal**: [Working system in X minutes]
**Prerequisites**: [Essential requirements only]

### Installation (3 commands max)
```bash
# 1. [First step with comment]
command-one

# 2. [Second step with comment]  
command-two

# 3. [Verification step]
command-three
```

**Expected Result**: [What user should see when successful]

## 🎯 What This Does

### Core Capabilities
1. **[Feature 1]**: [Brief description with value]
2. **[Feature 2]**: [Brief description with value]  
3. **[Feature 3]**: [Brief description with value]

### Key Benefits
- [Benefit 1 - user-focused]
- [Benefit 2 - user-focused]
- [Benefit 3 - user-focused]

## 🏗️ Architecture Overview

[Simple ASCII diagram or description]
```
[Component A] → [Component B] → [Component C]
      ↓
[Component D]
```

**Tech Stack**: [Key technologies]
**Integration**: [How it fits into larger system]

## 📦 Integration Guide

### Add to Your Project
```bash
# 1. [Copy/install step]
# 2. [Configuration step]
# 3. [Verification step]
```

### Basic Configuration
```json
{
  "example": "configuration",
  "key": "value"
}
```

## 📚 Documentation Hub

### 🚀 Getting Started
→ [Installation Guide](docs/guides/installation.md) - Complete setup ([X] min)
→ [Quick Start Tutorial](docs/guides/quick-start.md) - First working example ([X] min)
→ [Configuration](docs/guides/configuration.md) - Environment setup ([X] min)

### 🔧 Technical Reference
→ [Architecture Overview](docs/guides/architecture/) - System design details
→ [API Reference](docs/guides/api-reference.md) - Complete endpoint documentation
→ [Hook Events](docs/guides/hook-events.md) - Event types and payloads

### 🛠️ Development
→ [Contributing Guide](CONTRIBUTING.md) - How to contribute to this project
→ [Development Setup](docs/guides/development.md) - Local development environment
→ [Testing Guide](docs/guides/testing.md) - Test suites and validation

## 🛠️ Common Commands

| Task | Command | Time | Notes |
|------|---------|------|-------|
| [Task 1] | `command-1` | [X]s | [Brief note] |
| [Task 2] | `command-2` | [X]m | [Brief note] |
| [Task 3] | `command-3` | [X]m | [Brief note] |

## 🔌 Quick Reference

### Most-Used [APIs/Features/Commands]
- **[Item 1]**: [Brief description]
- **[Item 2]**: [Brief description]
- **[Item 3]**: [Brief description]

[Complete Reference →](docs/guides/complete-reference.md)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Follow [coding standards]
4. Submit pull request

**Full Guide**: [Contributing Documentation](CONTRIBUTING.md)

## 📄 License

[License Type] - See [LICENSE](LICENSE) file for details

---

**📚 For comprehensive documentation, visit our [guides directory](docs/guides/).**
```

---

## Template 2: Installation/Setup Guide

**Use Case**: Step-by-step setup instructions
**Target Length**: 300-500 lines
**Focus**: Clear procedures and verification

```markdown
[🏠 Home](../../../README.md) → [📚 Guides](../README.md) → **Installation Guide**

# Installation Guide

**Time to Complete**: [X] minutes
**Prerequisites**: [Specific requirements with links]
**Difficulty**: [Beginner/Intermediate/Advanced]
**Last Updated**: [Date]

## Overview

This guide walks you through setting up [system name] from scratch. By the end, you'll have:
- [Outcome 1]
- [Outcome 2]  
- [Outcome 3]

## Prerequisites

### Required Software
- **[Tool 1]**: [Version] - [Installation link]
- **[Tool 2]**: [Version] - [Installation link]
- **[Tool 3]**: [Version] - [Installation link]

### Required Accounts/Keys
- **[Service 1]**: [How to get] - [Link to setup]
- **[Service 2]**: [How to get] - [Link to setup]

### System Requirements
- **OS**: [Supported operating systems]
- **Memory**: [RAM requirements]
- **Storage**: [Disk space needed]

## Installation Steps

### Step 1: [First Major Step]

**Goal**: [What this step accomplishes]

```bash
# [Comment explaining what this does]
command-here

# Expected output:
# [Show what successful output looks like]
```

**Verification**: 
```bash
verification-command
# Should return: [expected result]
```

**Troubleshooting**:
- **Issue**: [Common problem]
  **Solution**: [How to fix]

### Step 2: [Second Major Step]

**Goal**: [What this step accomplishes]

```bash
# [Comment explaining what this does]
command-here
```

**Configuration**:
Create/update configuration file:
```json
{
  "setting1": "value1",
  "setting2": "value2"
}
```

**Verification**:
```bash
verification-command
# Should return: [expected result]
```

### Step 3: [Final Step]

**Goal**: [What this step accomplishes]

```bash
# [Comment explaining what this does]
final-command
```

**Expected Result**: [Detailed description of what user should see]

## Final Verification

### System Health Check
```bash
# Run comprehensive test
test-command

# Expected output:
✅ [Service 1] - Running
✅ [Service 2] - Connected  
✅ [Service 3] - Healthy
```

### Access Dashboard
1. Open browser to `http://localhost:[port]`
2. You should see: [Description of working dashboard]
3. Test functionality: [Quick test to perform]

## Configuration Options

### Basic Configuration
```json
{
  "essential_setting": "value",
  "another_setting": "value"
}
```

### Advanced Configuration
For advanced options, see [Configuration Reference](configuration-reference.md)

## Troubleshooting

### Common Issues

#### [Issue 1]: [Error message or symptom]
**Symptom**: [What user sees]
**Cause**: [Why this happens]
**Solution**: 
```bash
solution-command
```
**Prevention**: [How to avoid in future]

#### [Issue 2]: [Error message or symptom]
**Symptom**: [What user sees]
**Cause**: [Why this happens]  
**Solution**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Getting Help
- **Documentation**: [Link to relevant docs]
- **Issues**: [Link to issue tracker]
- **Community**: [Link to discussions/chat]

## Next Steps

✅ **Installation Complete!**

**Recommended Next Actions**:
1. [First recommended action] - [Link to guide]
2. [Second recommended action] - [Link to guide]
3. [Third recommended action] - [Link to guide]

## Related Documentation
📖 **Prerequisites**: [System Requirements](system-requirements.md)
🔗 **Next Steps**: [Configuration Guide](configuration.md)
🆘 **If you have issues**: [Troubleshooting Guide](troubleshooting.md)
```

---

## Template 3: API Reference Guide

**Use Case**: Technical reference documentation
**Target Length**: 500-1000 lines
**Focus**: Comprehensive technical details

```markdown
[🏠 Home](../../../README.md) → [📚 Guides](../README.md) → **API Reference**

# API Reference

**Version**: [API Version]
**Base URL**: `[Base URL]`
**Authentication**: [Auth method]
**Last Updated**: [Date]

## Quick Start

### Authentication
```bash
# Set your API key
export API_KEY="your_key_here"

# Test connectivity
curl -H "Authorization: Bearer $API_KEY" [base_url]/health
```

### Common Endpoints
| Method | Endpoint | Purpose | Rate Limit |
|--------|----------|---------|------------|
| GET | `/api/status` | System status | None |
| POST | `/api/events` | Submit events | 1000/hour |
| GET | `/api/sessions` | List sessions | 100/hour |

## Authentication

### API Key Setup
1. [How to get API key]
2. [How to configure]
3. [How to test]

### Headers Required
```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

## Core Endpoints

### Events API

#### Submit Event
**Endpoint**: `POST /api/events`
**Purpose**: [What this endpoint does]
**Rate Limit**: [Limit info]

**Request Format**:
```json
{
  "event_type": "string",
  "payload": {
    "key": "value"
  },
  "timestamp": "2025-01-01T00:00:00Z"
}
```

**Response Format**:
```json
{
  "success": true,
  "event_id": "12345",
  "message": "Event submitted successfully"
}
```

**Example Usage**:
```bash
curl -X POST [base_url]/api/events \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "test_event",
    "payload": {"test": "data"}
  }'
```

**Error Responses**:
| Code | Message | Cause | Solution |
|------|---------|-------|----------|
| 400 | Invalid payload | Malformed JSON | Check request format |
| 401 | Unauthorized | Invalid API key | Verify API key |
| 429 | Rate limited | Too many requests | Wait and retry |

#### Get Events
**Endpoint**: `GET /api/events`
**Purpose**: [What this endpoint does]

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Max results (default: 50) |
| `offset` | integer | No | Pagination offset |
| `event_type` | string | No | Filter by event type |

**Example Usage**:
```bash
# Get recent events
curl -H "Authorization: Bearer $API_KEY" \
  "[base_url]/api/events?limit=10"

# Filter by type
curl -H "Authorization: Bearer $API_KEY" \
  "[base_url]/api/events?event_type=user_action"
```

## WebSocket API

### Connection
**Endpoint**: `ws://[base_url]/ws`
**Authentication**: Via query parameter

```javascript
const ws = new WebSocket('ws://[base_url]/ws?token=YOUR_API_KEY');

ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### Message Types
| Type | Direction | Purpose |
|------|-----------|---------|
| `event_update` | Server → Client | New event notification |
| `heartbeat` | Server ↔ Client | Connection health |
| `subscribe` | Client → Server | Subscribe to events |

## Error Handling

### Standard Error Format
```json
{
  "error": true,
  "code": "ERROR_CODE",
  "message": "Human readable message",
  "details": {
    "field": "Additional context"
  }
}
```

### Common Error Codes
| Code | HTTP Status | Description | Solution |
|------|-------------|-------------|----------|
| `INVALID_REQUEST` | 400 | Request format error | Check JSON syntax |
| `UNAUTHORIZED` | 401 | Authentication failed | Verify API key |
| `NOT_FOUND` | 404 | Resource not found | Check endpoint URL |
| `RATE_LIMITED` | 429 | Too many requests | Implement backoff |

## Rate Limits

### Current Limits
- **Events API**: 1000 requests/hour
- **Sessions API**: 100 requests/hour  
- **WebSocket**: 1 connection per API key

### Handling Rate Limits
```javascript
async function submitEvent(data) {
  try {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (response.status === 429) {
      // Rate limited - wait and retry
      await new Promise(resolve => setTimeout(resolve, 5000));
      return submitEvent(data);
    }
    
    return response.json();
  } catch (error) {
    console.error('API Error:', error);
  }
}
```

## SDKs and Libraries

### Official SDKs
- **JavaScript/Node.js**: [Link to SDK]
- **Python**: [Link to SDK]
- **Go**: [Link to SDK]

### Community Libraries
- **[Language]**: [Library name] - [Description]

## Examples

### Complete Integration Example
```javascript
// [Complete working example]
```

### Common Use Cases
1. **[Use Case 1]**: [Example code]
2. **[Use Case 2]**: [Example code]
3. **[Use Case 3]**: [Example code]

## Changelog

### Version [X.X.X] - [Date]
- [Change 1]
- [Change 2]
- [Breaking change with migration guide]

## Related Documentation
📖 **Getting Started**: [Installation Guide](installation.md)
🔧 **Configuration**: [Setup Guide](configuration.md)
🆘 **Troubleshooting**: [API Issues](troubleshooting.md#api-issues)
```

---

## Template 4: Troubleshooting Guide

**Use Case**: Problem-solving documentation
**Target Length**: 400-800 lines
**Focus**: Solutions and diagnostics

```markdown
[🏠 Home](../../../README.md) → [📚 Guides](../README.md) → **Troubleshooting Guide**

# Troubleshooting Guide

**Last Updated**: [Date]
**Covers**: [System/service name]
**Emergency Contact**: [If applicable]

## Quick Diagnostic Steps

### System Health Check
```bash
# Run this first to check overall system status
./scripts/health-check.sh

# Expected output:
✅ Database: Connected
✅ Server: Running (Port 4000)
✅ Client: Running (Port 5173)
✅ WebSocket: Active connections: 2
```

### Common Quick Fixes
1. **Restart System**: `./scripts/restart-system.sh`
2. **Clear Cache**: `./scripts/clear-cache.sh`
3. **Reset Database**: `./scripts/reset-database.sh` ⚠️ (Destructive)

## Installation Issues

### Issue: [Specific Error/Problem]
**Symptom**: [What user sees/experiences]
```
[Exact error message if applicable]
```

**Likely Causes**:
- [Most common cause]
- [Second most common cause]
- [Less common cause]

**Solution**:
```bash
# Step 1: [What this does]
command-one

# Step 2: [What this does]
command-two

# Verification
verification-command
```

**Prevention**: [How to avoid this issue in future]

### Issue: Dependencies Not Installing
**Symptom**: Installation fails with dependency errors

**For Node.js Projects**:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**For Python Projects**:
```bash
# Update pip and reinstall
pip install --upgrade pip
pip install -r requirements.txt --force-reinstall
```

**Alternative Solutions**:
- Use different package manager: [Instructions]
- Manual dependency installation: [Instructions]

## Runtime Issues

### Issue: Server Won't Start
**Symptoms**:
- Port already in use errors
- Permission denied errors
- Service fails to bind

**Diagnostic Steps**:
```bash
# Check what's using the port
lsof -ti:4000

# Check service status
systemctl status [service-name]  # Linux
brew services list | grep [service]  # macOS
```

**Solutions**:

#### Port Already in Use
```bash
# Kill process using port 4000
lsof -ti:4000 | xargs kill -9

# Or use different port
PORT=4001 npm start
```

#### Permission Issues
```bash
# Fix permissions (Linux/macOS)
sudo chown -R $USER:$USER /path/to/project

# Run with proper permissions
sudo ./start-script.sh
```

### Issue: Database Connection Failed
**Symptom**: Application starts but can't connect to database

**Diagnostic Steps**:
```bash
# Check database service
systemctl status postgresql  # or mysql, sqlite, etc.

# Test connection manually
psql -h localhost -U username -d database_name
```

**Solutions**:
```bash
# Start database service
systemctl start postgresql

# Reset database (if safe to do)
./scripts/reset-database.sh

# Check configuration
cat config/database.yml
```

## API/Network Issues

### Issue: API Requests Failing
**Symptoms**:
- 404 Not Found errors
- Connection timeouts
- CORS errors

**Diagnostic Steps**:
```bash
# Test basic connectivity
curl -I http://localhost:4000/health

# Check server logs
tail -f logs/server.log

# Test with verbose output
curl -v http://localhost:4000/api/endpoint
```

**Common Solutions**:

#### CORS Issues
Add to server configuration:
```javascript
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
```

#### Authentication Issues
```bash
# Test with proper headers
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     http://localhost:4000/api/endpoint
```

### Issue: WebSocket Connections Failing
**Symptom**: Real-time features not working

**Diagnostic Steps**:
```bash
# Test WebSocket endpoint
wscat -c ws://localhost:4000/ws

# Check browser console for WebSocket errors
# Open browser dev tools → Network → WS tab
```

**Solutions**:
- Check firewall settings
- Verify WebSocket proxy configuration
- Test with different browser

## Performance Issues

### Issue: Slow Response Times
**Symptoms**:
- Dashboard takes >5 seconds to load
- API responses timeout
- High CPU/memory usage

**Diagnostic Steps**:
```bash
# Check system resources
top
htop  # if available
df -h  # disk usage

# Monitor API response times
time curl http://localhost:4000/api/events

# Check database performance
EXPLAIN ANALYZE SELECT * FROM events LIMIT 10;
```

**Solutions**:

#### Database Optimization
```sql
-- Create missing indexes
CREATE INDEX idx_events_timestamp ON events(timestamp);

-- Analyze and optimize
ANALYZE;
VACUUM;  -- PostgreSQL
OPTIMIZE TABLE events;  -- MySQL
```

#### Memory Issues
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm start

# Clear application cache
rm -rf .cache/ tmp/
```

## Development Issues

### Issue: Hot Reload Not Working
**Symptom**: Changes to code don't appear in browser

**Solutions**:
```bash
# Restart development server
npm run dev

# Clear browser cache
# Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R)

# Check for file watching limits (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Issue: Tests Failing
**Symptom**: Test suite reports failures

**Diagnostic Steps**:
```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test -- tests/specific-test.js

# Check test environment
NODE_ENV=test npm test
```

**Common Solutions**:
- Clear test database: `NODE_ENV=test ./scripts/reset-database.sh`
- Update test snapshots: `npm test -- --updateSnapshot`
- Check test dependencies: `npm install --only=dev`

## Environment-Specific Issues

### Docker Issues
```bash
# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up

# Check container logs
docker-compose logs [service-name]

# Access container shell
docker-compose exec [service-name] /bin/bash
```

### CI/CD Issues
```bash
# Check environment variables
env | grep -E "(API_KEY|DATABASE_URL|NODE_ENV)"

# Verify build process
npm run build
npm run test:ci
```

## Log Analysis

### Enable Debug Logging
```bash
# Enable verbose logging
DEBUG=* npm start

# Application-specific debug
LOG_LEVEL=debug npm start
```

### Log File Locations
- **Application logs**: `logs/app.log`
- **Error logs**: `logs/error.log`
- **Access logs**: `logs/access.log`
- **System logs**: `/var/log/` (Linux), `~/Library/Logs/` (macOS)

### Common Log Patterns
```bash
# Find errors in logs
grep -i error logs/*.log

# Monitor logs in real-time
tail -f logs/app.log

# Search for specific patterns
grep "API request failed" logs/app.log
```

## Getting Additional Help

### Before Requesting Help
1. ✅ Run system health check
2. ✅ Check relevant log files
3. ✅ Try common solutions above
4. ✅ Document exact error messages
5. ✅ Note your environment details

### Information to Include
- **Operating System**: [OS and version]
- **Node.js Version**: `node --version`
- **Package Manager**: `npm --version` or `yarn --version`
- **Database Version**: [If applicable]
- **Error Messages**: [Exact text, not screenshots]
- **Steps to Reproduce**: [Numbered list]

### Support Channels
- **Documentation**: [Link to docs]
- **Issue Tracker**: [Link to GitHub issues]
- **Community Forum**: [Link to discussions]
- **Chat**: [Link to Discord/Slack/etc.]

## Related Documentation
📖 **Installation**: [Setup Guide](installation.md)
🔧 **Configuration**: [Config Reference](configuration.md)
📚 **API Issues**: [API Reference](api-reference.md#error-handling)
```

---

## Template 5: Phase Documentation

**Use Case**: Project phase planning and tracking
**Target Length**: 300-600 lines
**Focus**: Planning and progress tracking

```markdown
# Phase [XX]: [Phase Name]

## Phase Overview

**Phase ID**: [XX-descriptive-name]
**Duration**: [X] weeks (estimated)
**Priority**: [High/Medium/Low]
**Dependencies**: [List of blocking phases or requirements]
**Team Size**: [X] engineers + [X] support roles

## Objectives

### Primary Goals
1. **[Goal 1]**: [Specific, measurable outcome]
2. **[Goal 2]**: [Specific, measurable outcome]
3. **[Goal 3]**: [Specific, measurable outcome]

### Success Metrics
- [ ] [Metric 1 with specific target]
- [ ] [Metric 2 with specific target]
- [ ] [Metric 3 with specific target]

## Acceptance Criteria

### Must-Have Requirements
- [ ] [Requirement 1 - clearly testable]
- [ ] [Requirement 2 - clearly testable]
- [ ] [Requirement 3 - clearly testable]

### Should-Have Requirements
- [ ] [Nice-to-have 1]
- [ ] [Nice-to-have 2]

### Quality Gates
1. **Pre-Implementation Gate**: [What must be ready before starting]
2. **Mid-Phase Gate**: [Checkpoint requirements]
3. **Final Gate**: [Completion requirements]

## Work Package Breakdown

### Summary
- **Total Work Packages**: [X]
- **Parallel Execution Batches**: [X]
- **Critical Path**: [WP-XX → WP-XX → WP-XX]

### Batch 1: [Batch Name] (Parallel)
**Duration**: [X] days
**Engineers**: [X] (working in parallel)

#### WP-01: [Work Package Name]
- **Owner**: [Role/Name]
- **Duration**: [X] hours
- **Dependencies**: [None or specific WPs]
- **Deliverables**: 
  - [Deliverable 1]
  - [Deliverable 2]
- **Success Criteria**: [How to verify completion]

#### WP-02: [Work Package Name]
- **Owner**: [Role/Name]
- **Duration**: [X] hours
- **Dependencies**: [None or specific WPs]
- **Deliverables**:
  - [Deliverable 1]
  - [Deliverable 2]

### Batch 2: [Batch Name] (Sequential)
**Duration**: [X] days
**Dependencies**: Batch 1 completion

#### WP-03: [Work Package Name]
- **Owner**: [Role/Name]
- **Duration**: [X] hours
- **Dependencies**: WP-01, WP-02
- **Critical Path**: ✅ (blocks all downstream work)

## Risk Assessment

### High Risk Items
1. **[Risk 1]**: [Description]
   - **Impact**: [High/Medium/Low]
   - **Probability**: [High/Medium/Low]
   - **Mitigation**: [Specific steps to reduce risk]

2. **[Risk 2]**: [Description]
   - **Impact**: [High/Medium/Low]
   - **Probability**: [High/Medium/Low]
   - **Mitigation**: [Specific steps to reduce risk]

### Risk Monitoring
- **Daily Check**: [What to monitor daily]
- **Weekly Review**: [What to assess weekly]
- **Escalation Triggers**: [When to escalate issues]

## Timeline

### Week 1: [Week Focus]
- **Days 1-2**: [Activities]
- **Days 3-4**: [Activities]  
- **Day 5**: [Activities]

### Week 2: [Week Focus]
- **Days 1-2**: [Activities]
- **Days 3-4**: [Activities]
- **Day 5**: [Activities]

### Milestones
- **[Date]**: [Milestone 1]
- **[Date]**: [Milestone 2]
- **[Date]**: [Phase completion]

## Resource Requirements

### Team Allocation
**Engineers**:
- [Engineer Role 1]: [Responsibility area]
- [Engineer Role 2]: [Responsibility area]
- [Engineer Role 3]: [Responsibility area]

**Support Roles**:
- **Architect**: [Specific responsibilities]
- **Designer**: [Specific responsibilities]
- **Gatekeeper**: [Verification responsibilities]

### External Dependencies
- [Dependency 1]: [Who provides, when needed]
- [Dependency 2]: [Who provides, when needed]

## Communication Plan

### Daily Standups
- **Time**: [When]
- **Participants**: [Who]
- **Format**: [Brief structure]

### Progress Reporting
- **Frequency**: [How often]
- **Recipients**: [Who gets updates]
- **Format**: [How delivered]

### Issue Escalation
- **Level 1**: [Team member → Lead]
- **Level 2**: [Lead → Architect]
- **Level 3**: [Architect → Stakeholder]

## Success Indicators

### Quantitative Measures
- [Metric 1]: [Target value]
- [Metric 2]: [Target value]
- [Metric 3]: [Target value]

### Qualitative Measures
- [Quality indicator 1]
- [Quality indicator 2]
- [Quality indicator 3]

## Phase Completion Definition

Phase is considered complete when:
1. ✅ All must-have acceptance criteria met
2. ✅ All quality gates passed
3. ✅ Documentation updated
4. ✅ Team knowledge transfer complete
5. ✅ Next phase dependencies satisfied

## Retrospective Planning

### What to Evaluate
- [Aspect 1 to review]
- [Aspect 2 to review]
- [Aspect 3 to review]

### Success Metrics Review
- [How to measure success]
- [What data to collect]
- [How to apply learnings]

## Related Documentation
📋 **Work Packages**: [Detailed WP breakdown](wp-breakdown.md)
📊 **Progress Tracking**: [Current status](progress-tracker.md)
🎯 **Requirements**: [Detailed requirements](requirements.md)
```

---

## Template Implementation Guide

### For Documentation Engineers

#### LisaStream (README Focus)
Use **Template 1: README Navigation Hub**
- Focus on navigation clarity
- Implement progressive disclosure
- Test quick start flow

#### TomQuantum (Installation Focus)
Use **Template 2: Installation/Setup Guide**
- Include verification steps
- Add troubleshooting section
- Cross-reference with configuration

#### NinaCore (API Focus)
Use **Template 3: API Reference Guide**
- Organize by user intent
- Include practical examples
- Link to related guides

### Quality Checklist for All Templates

#### Content Quality
- [ ] Information organized by user need
- [ ] Clear, actionable steps
- [ ] Verification methods provided
- [ ] Error cases handled

#### Navigation Quality
- [ ] Breadcrumb navigation present
- [ ] Cross-references to related content
- [ ] Clear next steps provided
- [ ] No dead ends or orphaned content

#### Visual Quality
- [ ] Consistent heading hierarchy
- [ ] Appropriate use of formatting
- [ ] Scannable content structure
- [ ] Mobile-friendly layout

#### Technical Quality
- [ ] All links working correctly
- [ ] Code examples tested
- [ ] Commands verified
- [ ] Screenshots current

### Template Maintenance

#### Regular Updates
- **Monthly**: Review for accuracy
- **Quarterly**: Update based on user feedback
- **On changes**: Update affected templates
- **Annual**: Comprehensive template review

#### Version Control
- Track template changes in git
- Document reasons for modifications
- Maintain backward compatibility
- Communicate changes to team

This template collection ensures consistency, usability, and maintainability across all documentation in our multi-agent observability system.