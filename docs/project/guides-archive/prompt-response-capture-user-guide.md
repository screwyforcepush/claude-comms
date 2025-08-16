# Agent Prompt & Response Capture - User Guide

**Author:** DavidStellar (Technical Documentation Specialist)  
**Date:** 2025-08-14  
**Status:** Complete User Guide  

## Overview

The Agent Prompt & Response Capture feature provides complete visibility into what prompts are sent to create subagents and their full responses. This powerful capability enables debugging, auditing, and understanding of multi-agent workflows by capturing the complete conversation context.

### Key Benefits

- **Complete Transparency**: See exactly what prompts were sent to create each agent
- **Full Response Context**: View complete agent outputs including tool calls and responses
- **Debugging Support**: Quickly identify why agents behaved unexpectedly
- **Audit Trail**: Maintain complete records of agent interactions
- **Learning Tool**: Study effective prompting patterns across successful orchestrations

## Getting Started

### Prerequisites

1. **System Running**: Ensure the observability system is active:
   ```bash
   ./scripts/start-system.sh
   ```

2. **Dashboard Access**: Open the dashboard at `http://localhost:5173`

3. **Active Session**: Create agents using the Task tool to see prompt/response capture in action

### Basic Workflow

1. **Create Subagents**: Use the Task tool in Claude Code to create subagents
2. **View Sessions Tab**: Navigate to the "Sessions" tab in the dashboard
3. **Find Your Session**: Locate your session in the timeline
4. **View Agent Details**: Click on any agent to see their prompt and response

## Feature Walkthrough

### 1. Sessions Tab Navigation

The Sessions tab displays all active and completed agent orchestration sessions:

- **Timeline View**: Visual timeline showing agent execution across sessions
- **Session Lanes**: Each horizontal lane represents one orchestration session
- **Agent Branches**: Colored lines branching from the main orchestrator line
- **Real-time Updates**: Live updates as new agents are created and complete

### 2. Agent Detail View

Click on any agent in the timeline to open the Agent Detail Panel:

#### Agent Metadata
- **Agent Name**: Unique identifier for the agent
- **Type**: Agent role (engineer, architect, gatekeeper, etc.)
- **Status**: Current state (pending, active, completed, failed)
- **Creation Time**: When the agent was spawned
- **Completion Time**: When the agent finished (if applicable)

#### Prompt & Response Display
- **Initial Prompt**: The complete prompt sent to create the agent
- **Final Response**: The complete response from the agent
- **Word Count**: Statistics for both prompt and response
- **Copy Functions**: Easy copying of prompt or response text

### 3. Prompt Response Modal

For detailed analysis, use the full-screen Prompt Response Modal:

#### Access Methods
- Double-click any agent in the Sessions tab
- Click the "View Full" button in the Agent Detail Panel
- Use keyboard shortcut when agent is selected

#### Modal Features

**Two View Modes:**
- **Side-by-Side**: Prompt and response displayed side by side
- **Stacked**: Prompt above response for better readability

**Interactive Elements:**
- **Copy Buttons**: Copy prompt or response to clipboard
- **Word Counts**: See word count for each section
- **View Mode Toggle**: Switch between display layouts
- **Keyboard Navigation**: Use Esc to close, arrow keys to navigate

### 4. User Prompt Analysis

The system also captures user prompts that initiate orchestrations:

#### Prompt Detail Panel
- **Timeline Integration**: Blue circular indicators show user prompts
- **Click to Open**: Click any blue prompt indicator to view details
- **Prompt Analysis**: Automatic complexity analysis and metadata
- **Content Display**: Full prompt text with syntax highlighting

#### Analysis Features
- **Complexity Rating**: Simple, Moderate, or Complex based on word count
- **Metadata**: Timestamps, session IDs, and contextual information
- **Export Options**: Copy prompt content for reuse or analysis

## Advanced Usage

### 1. Multi-Agent Analysis

When working with multiple agents in a session:

1. **Agent Comparison**: Open multiple agent detail panels to compare prompts
2. **Pattern Recognition**: Identify successful prompting patterns
3. **Response Analysis**: Compare how different agent types respond to similar prompts
4. **Batch Analysis**: Analyze agents created in the same batch for consistency

### 2. Session Timeline Navigation

Navigate efficiently through complex sessions:

- **Zoom Controls**: Use mouse wheel or zoom buttons to focus on specific time periods
- **Time Markers**: Click on specific times to jump to that moment
- **Agent Filtering**: Filter by agent type or status to focus on specific categories
- **Search**: Use session filters to find specific orchestrations

### 3. Debugging Workflows

Use prompt/response capture for troubleshooting:

#### Identify Agent Issues
1. Locate failed or underperforming agents in the timeline
2. Review their initial prompts for potential issues
3. Examine their responses for error patterns
4. Compare with successful similar agents

#### Prompt Optimization
1. Study prompts that led to successful agent outcomes
2. Identify effective instruction patterns
3. Note context that leads to better agent performance
4. Refine future prompts based on historical success

### 4. Best Practices for Analysis

#### Effective Prompt Review
- **Check Context**: Ensure prompts include sufficient context for the task
- **Verify Constraints**: Confirm important constraints are clearly stated
- **Review Success Criteria**: Check if completion criteria are well-defined
- **Analyze Team Instructions**: Ensure collaboration guidance is included

#### Response Analysis
- **Quality Assessment**: Evaluate response completeness and accuracy
- **Error Identification**: Look for recurring error patterns
- **Performance Patterns**: Identify factors that lead to faster/slower completion
- **Output Format**: Assess if responses follow expected formats

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Esc` | Close open modal or panel |
| `Ctrl+C` | Copy selected text when in modal |
| `Tab` | Navigate between interactive elements |
| `Enter` | Activate selected button or link |
| `Space` | Scroll modal content down |
| `Shift+Space` | Scroll modal content up |

## Tips and Tricks

### 1. Efficient Navigation
- Use double-click to quickly open agent details in full-screen mode
- Right-click agents for context menu with quick actions
- Use keyboard shortcuts for faster navigation

### 2. Content Management
- Copy prompts to build a library of effective patterns
- Export successful prompts for reuse in future orchestrations
- Use word count information to optimize prompt length

### 3. Analysis Workflow
- Open multiple browser tabs to compare different sessions
- Use the stacked view mode for detailed line-by-line analysis
- Take screenshots of effective prompt/response pairs for documentation

### 4. Performance Optimization
- Large responses may take a moment to load - be patient
- Use the preview functionality for quick scanning before full load
- Close unused detail panels to maintain dashboard performance

## Data Privacy and Security

### What is Captured
- **Full Prompt Text**: Complete instructions sent to agents
- **Complete Responses**: All agent outputs including tool calls
- **Metadata**: Timestamps, session IDs, and status information
- **Context**: Associated chat transcripts when available

### Data Handling
- All data is stored locally in SQLite database
- No data is transmitted outside your local system
- Data persists until manually cleared
- Regular cleanup recommended for large deployments

### Sensitive Information
- Be aware that all prompt content is captured and stored
- Avoid including secrets or sensitive data in prompts
- Regularly review stored data for sensitive content
- Use the export function to archive important data before cleanup

## Limitations and Considerations

### Current Limitations
- **Storage Size**: Large prompts/responses (>1MB) may affect performance
- **Historical Data**: Only captures data from when the feature was enabled
- **Search**: No built-in search within prompt/response content (use browser search)
- **Export Formats**: Currently supports text copy only (no structured export)

### Performance Considerations
- Large sessions (50+ agents) may experience slower loading
- Complex responses with extensive tool outputs take longer to render
- Modal performance may degrade with very large text content
- Real-time updates may pause during intensive analysis

### Browser Compatibility
- Tested on Chrome, Firefox, Safari, and Edge
- Requires JavaScript enabled
- Best experience with modern browsers
- Mobile support available but optimized for desktop use

## Getting Help

### Common Questions
- **Q: Why don't I see prompt/response data for some agents?**
  - A: The feature was recently implemented. Only agents created after the feature was enabled will have capture data.

- **Q: Can I export prompt/response data in structured formats?**
  - A: Currently, only text copying is supported. Structured export is planned for future releases.

- **Q: How much storage space does capture data use?**
  - A: Varies by usage, but typical sessions use 1-10MB per session. Monitor disk space with heavy usage.

### Support Resources
- Check server logs for capture-related errors
- Verify WebSocket connectivity for real-time updates
- Review browser console for JavaScript errors
- Restart the system if capture appears to stop working

### Feature Requests
Submit enhancement requests for:
- Additional export formats
- Search and filtering within content
- Prompt template creation
- Response pattern analysis
- Automated prompt optimization suggestions

---

This user guide provides comprehensive coverage of the Agent Prompt & Response Capture feature. For technical implementation details, refer to the [Agent Prompt/Response Architecture](./agent-prompt-response-architecture.md) document.