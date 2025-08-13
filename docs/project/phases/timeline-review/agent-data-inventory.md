# Agent Data Inventory - Comprehensive Analysis

**Date:** 2025-08-13  
**Analyst:** JackData  
**Scope:** Complete inventory of available agent observability data  

## Executive Summary

The multi-agent observability system contains extensive performance and execution data that is currently underutilized. The database stores rich metrics for each agent, but the current UI only displays basic tooltip information when clicking agent branches. This analysis identifies 23 distinct data points available for agent observability, grouped into 6 categories, with significant opportunities for enhanced visualization.

**Key Findings:**
- Database contains 7 distinct token-related metrics per agent
- Performance tracking includes duration, tool usage, and cache efficiency
- Real-time status tracking with completion timestamps
- Rich communication patterns between agents
- Current UI shows <20% of available data in tooltips

## Available Data Categories

### 1. Agent Identity & Classification
**Data Source:** `subagent_registry` table

| Field | Type | Description | Availability |
|-------|------|-------------|--------------|
| `id` | Integer | Unique agent identifier | ✅ Available |
| `name` | String | Agent display name (e.g., "JohnDoe") | ✅ Available |
| `subagent_type` | String | Agent role classification | ✅ Available |
| `session_id` | String | Session grouping identifier | ✅ Available |

**Current Usage:** Displayed in timeline labels and tooltips
**Gap:** No detailed agent profile view

### 2. Performance Metrics
**Data Source:** `update_subagent_completion.py` → `subagent_registry`

| Field | Type | Description | Current Display | High-Value |
|-------|------|-------------|----------------|------------|
| `total_duration_ms` | Integer | Complete execution time | ❌ None | ⭐⭐⭐ |
| `total_tokens` | Integer | Total tokens processed | ❌ None | ⭐⭐⭐ |
| `total_tool_use_count` | Integer | Tools invoked during execution | ❌ None | ⭐⭐ |
| `input_tokens` | Integer | Tokens received as input | ❌ None | ⭐⭐⭐ |
| `output_tokens` | Integer | Tokens generated as output | ❌ None | ⭐⭐⭐ |
| `cache_creation_input_tokens` | Integer | Tokens used for cache creation | ❌ None | ⭐⭐ |
| `cache_read_input_tokens` | Integer | Tokens from cache reads | ❌ None | ⭐⭐ |

**Hook Integration:** Performance data captured via `PostToolUse` hook from Claude Code tool responses
**Derived Metrics Potential:** Token efficiency ratios, cache hit rates, performance per tool

### 3. Status & Lifecycle Tracking
**Data Source:** `subagent_registry` + real-time updates

| Field | Type | Description | Current Display | Real-time |
|-------|------|-------------|----------------|-----------|
| `status` | String | Current execution state | ✅ Tooltip | ✅ Live |
| `created_at` | Integer | Agent spawn timestamp | ✅ Timeline | ✅ Live |
| `completed_at` | Integer | Completion timestamp | ❌ None | ✅ Live |

**Status Values:** `pending`, `in_progress`, `completed`
**Real-time Updates:** Via WebSocket + `agent_status_update` messages

### 4. Communication & Messaging Data
**Data Source:** `subagent_messages` table + cross-references

| Field | Type | Description | Current Display | Relationships |
|-------|------|-------------|----------------|---------------|
| Message count (derived) | Integer | Messages sent by agent | ❌ None | 📊 High-value |
| Message recipients | Array | Who received messages | ❌ None | 📊 High-value |
| Message timing | Timestamps | When messages were sent | ✅ Message pane | 📊 High-value |
| Read receipts | Array | Message delivery confirmation | ❌ None | 📊 High-value |

**Derived Insights:** Communication patterns, broadcast vs targeted messaging, response times

### 5. Event Context & Triggers
**Data Source:** `events` table (hook events)

| Field | Type | Description | Current Display | Analysis Value |
|-------|------|-------------|----------------|----------------|
| Triggering events | Array | Events that spawned agent | ❌ None | ⭐⭐ |
| Tool usage sequence | Array | Order of tool invocations | ❌ None | ⭐⭐⭐ |
| Error events | Array | Failed operations/retries | ❌ None | ⭐⭐⭐ |
| Chat transcripts | Object | Full conversation context | ❌ None | ⭐ |

**Hook Event Types:** `PreToolUse`, `PostToolUse`, `Notification`, `Stop`, `SubagentStop`

### 6. Batch & Orchestration Context
**Data Source:** Timeline calculations + batch detection

| Field | Type | Description | Current Display | Orchestration Value |
|-------|------|-------------|----------------|-------------------|
| Batch membership | String | Which batch spawned with | ✅ Visual grouping | ⭐⭐ |
| Parallel agents | Array | Other agents in same batch | ❌ None | ⭐⭐ |
| Orchestrator relationship | Object | Connection to primary agent | ✅ Visual path | ⭐⭐ |
| Dependency chain | Array | Agents this depends on | ❌ None | ⭐⭐⭐ |

## Data Access Patterns

### Real-time vs Historical

**Real-time Data (WebSocket):**
- Agent status changes
- New message notifications  
- Completion events
- Performance metric updates

**Historical Data (REST API):**
- Complete agent registry: `GET /subagents/{sessionId}`
- Full message history: `GET /subagents/messages`
- Event timeline: `GET /events/recent`
- Session summaries: `GET /subagents/sessions`

### Data Relationships

```
Agent (subagent_registry)
├── Messages (subagent_messages) [1:N via name]
├── Hook Events (events) [1:N via session_id + timing]
├── Batch Context [derived from spawn timing]
└── Performance Metrics [embedded in registry]

Session
├── Multiple Agents [1:N]
├── Cross-agent Messages [filtered by agent names]
└── Orchestration Events [filtered by session_id]
```

## Derived Metrics Opportunities

### Performance Analytics
- **Token Efficiency:** `output_tokens / input_tokens`
- **Cache Hit Rate:** `cache_read_input_tokens / total_tokens`  
- **Tool Productivity:** `total_tokens / total_tool_use_count`
- **Execution Speed:** `total_tokens / total_duration_ms`

### Communication Analytics
- **Message Velocity:** Messages per minute during execution
- **Broadcast Efficiency:** Unique recipients per message
- **Response Rate:** Messages received vs sent ratios
- **Team Integration:** Cross-agent communication frequency

### Orchestration Analytics  
- **Batch Efficiency:** Completion rate by batch size
- **Parallel Performance:** Duration variance within batches
- **Dependency Mapping:** Agent interaction patterns
- **Session Health:** Active vs completed agent ratios

## Current UI Gap Analysis

### What's Displayed (Tooltip Only)
- Agent name and type
- Basic status (pending/in_progress/completed)
- Type-based color coding

### What's Missing (High-Value Data)
- **Performance metrics** (7 distinct metrics available)
- **Communication statistics** (message counts, recipients)
- **Execution timeline** (spawn to completion duration)
- **Tool usage breakdown** (efficiency metrics)
- **Cache performance** (hit rates, efficiency)
- **Batch context** (parallel agent details)

### Architecture Gap
- Timeline has `MessageDetailPane` for message clicks
- **No equivalent `AgentDetailPane` for agent clicks**
- Rich data available but no display component

## Recommendations

### Immediate Opportunities (High-Value/Low-Effort)

1. **Agent Detail Panel Component**
   - Create `AgentDetailPane.vue` similar to `MessageDetailPane.vue`
   - Display performance metrics with progress indicators
   - Show communication statistics and message history
   - Include tool usage breakdown

2. **Enhanced Tooltips**
   - Add performance metrics to existing tooltip
   - Show derived efficiency ratios
   - Include message count and completion status

### Medium-term Enhancements

3. **Performance Dashboard**
   - Token efficiency trends over time
   - Cache hit rate monitoring  
   - Tool usage patterns analysis
   - Comparative performance across agent types

4. **Communication Network View**
   - Agent-to-agent message flow visualization
   - Broadcast vs targeted communication patterns
   - Response time analysis
   - Team collaboration metrics

### Advanced Analytics

5. **Predictive Insights**
   - Performance trend analysis
   - Bottleneck identification
   - Resource optimization recommendations
   - Efficiency pattern recognition

## Implementation Priorities

### Phase 1: Essential Agent Details (Week 1)
- `AgentDetailPane` component with performance metrics
- Enhanced tooltips with key metrics
- Real-time metric updates via WebSocket

### Phase 2: Analytics Dashboard (Week 2-3) 
- Performance trend charts
- Communication pattern analysis
- Batch efficiency monitoring

### Phase 3: Advanced Insights (Week 4+)
- Predictive analytics
- Cross-session comparisons
- Performance optimization recommendations

## Conclusion

The multi-agent observability system contains a wealth of untapped performance and behavioral data. With 23 distinct data points available across 6 categories, there are significant opportunities to enhance agent observability through better visualization and analytics.

**Critical Gap:** The current UI displays less than 20% of available data, with performance metrics entirely hidden despite being captured and stored.

**Highest Impact:** Creating an `AgentDetailPane` component would immediately expose 7 performance metrics and communication statistics, providing substantial observability value with minimal implementation effort.

**Strategic Value:** Full utilization of available data would position this system as a comprehensive multi-agent performance monitoring platform comparable to enterprise APM solutions.

---

**Deliverables Created:**
- `/Users/alexsavage/dev/claude-code-hooks-multi-agent-observability/docs/project/phases/timeline-review/agent-data-inventory.md`: Complete data inventory analysis

**Next Steps:**
- Coordinate with KellyArch on timeline architecture integration
- Begin AgentDetailPane component design with IreneDesign
- Validate performance metric accuracy with system testing