# Formatting and Style Standards for Documentation

## Overview

These formatting standards ensure consistency, accessibility, and professional presentation across all documentation in our multi-agent observability system. Follow these guidelines to create scannable, maintainable documentation that serves users effectively.

## Writing Style Guidelines

### Voice and Tone
- **Voice**: Direct, helpful, professional
- **Tone**: Friendly but concise, encouraging but realistic
- **Person**: Use second person ("you") for instructions, first person plural ("we") for project decisions
- **Tense**: Present tense for current state, imperative for instructions

### Language Standards
- **Clarity**: Use simple, clear language over complex terminology
- **Consistency**: Use the same term for the same concept throughout
- **Accessibility**: Avoid jargon; define technical terms when first used
- **Inclusivity**: Use inclusive language; avoid assumptions about user background

### Examples of Preferred Style
```markdown
✅ Good: "Run the installation script to set up your environment"
❌ Poor: "Execute the installation script in order to provision your development environment"

✅ Good: "This guide helps you configure webhooks"
❌ Poor: "This guide will help you to configure webhooks"

✅ Good: "If the server fails to start, check port availability"
❌ Poor: "Should you encounter a situation where the server fails to start, you should check port availability"
```

## Markdown Formatting Standards

### Heading Hierarchy

#### H1: Document Title Only
```markdown
# Document Title - Brief Description
```
- Single H1 per document
- Include brief description after dash
- Maximum 12 words total

#### H2: Major Sections
```markdown
## 🚀 Quick Start
## 🎯 Core Features
## 📚 Documentation Hub
```
- Use descriptive, action-oriented text
- Include emoji for visual scanning
- Maximum 5 words after emoji

#### H3: Subsections
```markdown
### Prerequisites
### Installation Steps
### Verification Process
```
- No emoji prefixes (cleaner appearance)
- Specific, scannable topics
- Maximum 3 words each

#### H4: Sub-subsections (Rarely Used)
```markdown
#### Database Configuration
```
- Use sparingly (prefer lists or paragraphs)
- Only when H3 needs subdivision
- No emoji prefixes

### Emphasis and Formatting

#### Bold Text
```markdown
**Use for**: Important terms, key concepts, emphasis
**Example**: The **API key** is required for authentication
```

#### Italic Text
```markdown
*Use for*: Subtle emphasis, field names, placeholders
*Example*: Set the *database_url* parameter in your config
```

#### Code Formatting
```markdown
`inline code`: Commands, file names, variable names
`npm install`, `config.json`, `API_KEY`

```code blocks```: Multi-line code, configuration files
```

#### Strikethrough (Rare)
```markdown
~~deprecated feature~~ - Use only for showing removed/deprecated items
```

### Link Formatting

#### Internal Links
```markdown
→ [Descriptive Link Text](path/to/file.md) - Brief description
[Configuration Guide](../configuration.md) - Environment setup (15 min)
```
- Use arrow (→) for navigation lists
- Include time estimates when helpful
- Use relative paths for internal links

#### External Links
```markdown
[External Service](https://example.com) 🔗 - Opens in new window
[Download Tool](https://example.com/download) 📁 - (2.3MB ZIP file)
```
- Include 🔗 for external links
- Include 📁 and file size for downloads
- Use descriptive text, never "click here"

#### Cross-References
```markdown
See [Troubleshooting Section](#troubleshooting) below
Related: [API Reference](api-reference.md#authentication)
```

### Lists and Bullets

#### Unordered Lists
```markdown
- Use hyphens for consistency
- Start with lowercase (unless proper noun)
- End without periods (unless multiple sentences)
- Keep parallel structure

**Example**:
- Real-time event monitoring
- Inter-agent communication
- Dashboard visualization
- WebSocket connectivity
```

#### Ordered Lists
```markdown
1. Use numbers for sequential steps
2. Start with capital letter
3. End with period if sentence
4. Include verification when possible

**Example**:
1. Clone the repository to your local machine.
2. Install dependencies using `npm install`.
3. Start the development server with `npm start`.
4. Verify the dashboard loads at `http://localhost:5173`.
```

#### Nested Lists
```markdown
- Main category
  - Sub-item one
  - Sub-item two
    - Sub-sub-item (use sparingly)

1. Main step
   a. Sub-step A
   b. Sub-step B
2. Next main step
```

### Code Block Standards

#### Bash/Shell Commands
```markdown
```bash
# Clear comment explaining what this does
command-name --flag value

# Expected output indicator
# Output: Server started successfully
```

**Best Practices**:
- Always include comments for complex commands
- Show expected output when helpful
- Use consistent comment style (#)
- Group related commands together
```

#### JSON Configuration
```markdown
```json
{
  "setting1": "value1",
  "setting2": "value2",
  "nested": {
    "key": "value"
  }
}
```

**Best Practices**:
- Use proper indentation (2 spaces)
- Include comments in surrounding text
- Show complete, valid JSON
- Use realistic example values
```

#### JavaScript/TypeScript
```markdown
```javascript
// Clear comment explaining the purpose
const example = {
  key: 'value',
  method: function() {
    // Implementation details
    return result;
  }
};
```

**Best Practices**:
- Include relevant comments
- Use modern syntax
- Show complete examples
- Follow project coding standards
```

#### Multi-Language Code Blocks
```markdown
**JavaScript**:
```javascript
const result = await fetch('/api/data');
```

**Python**:
```python
response = requests.get('/api/data')
```

**cURL**:
```bash
curl -X GET http://localhost:4000/api/data
```
```

### Table Formatting

#### Standard Tables
```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value 1  | Value 2  | Value 3  |
| Value A  | Value B  | Value C  |
```

#### Table Alignment
```markdown
| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Left         | Center         | Right         |
```

#### Complex Tables
```markdown
| Method | Endpoint | Purpose | Rate Limit | Example |
|--------|----------|---------|------------|---------|
| GET    | `/api/events` | Retrieve events | 100/hour | `curl /api/events` |
| POST   | `/api/events` | Submit event | 1000/hour | See below |

**Note**: For very complex tables, consider using multiple simpler tables or lists.
```

### Quotes and Callouts

#### Blockquotes for Important Information
```markdown
> **⚡ Quick Note**: This step requires administrator privileges.

> **🔧 Pro Tip**: Use the `--verbose` flag for detailed output.

> **⚠️ Important**: This action cannot be undone.

> **🚨 Critical**: Backup your data before proceeding.
```

#### Multi-line Quotes
```markdown
> This is a longer note that spans multiple lines.
> Each line should start with the greater-than symbol.
> This creates a cohesive block quote appearance.
```

### Horizontal Rules and Separators

#### Section Breaks
```markdown
---

## Next Major Section
```
- Use three hyphens
- Add blank lines before and after
- Reserve for major section breaks

#### Visual Separators (Alternative)
```markdown
## Section One
[Content here]

## Section Two
[Content here]
```
- Prefer consistent heading hierarchy
- Use horizontal rules sparingly

## Visual Elements Standards

### Emoji Usage Guidelines

#### Functional Emojis (Standardized)
```markdown
🚀 Quick Start, Getting Started
🎯 Core features, What it does, Goals
🏗️ Architecture, System design
📦 Installation, Integration
📚 Documentation, Guides
🛠️ Development, Tools
🔧 Configuration, Settings
🔌 API, Endpoints
🆘 Troubleshooting, Help
⚡ Performance, Quick tips
⚠️ Warnings, Important notes
✅ Success, Verification, Completion
📸 Screenshots, Visual examples
🔗 External links
📁 Downloads, Files
💬 User input, Prompts
🔔 Notifications, Alerts
👥 Multi-agent, Team features
```

#### Emoji Usage Rules
- Use consistently across all documentation
- Maximum one emoji per heading
- Don't use emoji in code blocks or technical content
- Ensure emoji render correctly on all platforms

### Image and Screenshot Standards

#### Image Formatting
```markdown
![Descriptive Alt Text](path/to/image.png)

<img src="path/to/image.png" alt="Descriptive Alt Text" style="max-width: 800px; width: 100%;">
```

#### Screenshot Guidelines
- Use descriptive alt text
- Keep file sizes reasonable (<500KB)
- Use consistent browser/OS for screenshots
- Highlight relevant areas when necessary
- Update screenshots when UI changes

#### Diagram Standards
```markdown
```
Component A → Component B → Component C
     ↓              ↓
Component D    Component E
```

**ASCII Diagrams**:
- Use for simple architectural overviews
- Keep diagrams under 80 characters wide
- Use consistent symbols (→, ↓, ←, ↑)
```

### Accessibility Standards

#### Link Accessibility
```markdown
✅ Good: [Install Node.js from the official website](https://nodejs.org)
❌ Poor: [Click here](https://nodejs.org) to install Node.js
```

#### Image Accessibility
```markdown
✅ Good: ![Dashboard showing real-time agent events](dashboard-screenshot.png)
❌ Poor: ![Screenshot](dashboard.png)
```

#### Color and Contrast
- Don't rely on color alone to convey information
- Use sufficient contrast ratios
- Test with screen readers when possible

## Document Structure Standards

### Front Matter (When Applicable)
```markdown
---
title: "Document Title"
description: "Brief description of content"
last_updated: "2025-01-15"
difficulty: "Beginner"
time_to_complete: "15 minutes"
---
```

### Document Header Pattern
```markdown
[🏠 Home](../../../README.md) → [📚 Guides](../README.md) → **Current Guide**

# Guide Title

**Time to Complete**: 15 minutes
**Prerequisites**: [System Setup](setup.md)
**Difficulty**: Beginner
**Last Updated**: January 2025
```

### Document Footer Pattern
```markdown
## Related Documentation
📖 **Prerequisites**: [System Requirements](requirements.md)
🔗 **Next Steps**: [Configuration Guide](configuration.md)
🆘 **Need help?**: [Troubleshooting Guide](troubleshooting.md)

---

**📚 For more guides, visit our [documentation hub](../README.md).**
```

## Content Organization Standards

### Information Hierarchy
1. **Overview/Summary** - What this document covers
2. **Prerequisites** - What user needs before starting
3. **Main Content** - Step-by-step instructions or reference material
4. **Verification** - How to confirm success
5. **Troubleshooting** - Common issues and solutions
6. **Next Steps** - What to do after completing this guide

### Progressive Disclosure
```markdown
## Quick Overview
[Brief summary and common use cases]

## Detailed Instructions
[Step-by-step procedures]

## Advanced Configuration
[Complex scenarios and edge cases]

[Advanced Topics →](advanced-topics.md)
```

### Cross-Reference Pattern
```markdown
## Prerequisites
Before starting this guide, ensure you have:
- [System installed](installation.md) ✅
- [Environment configured](configuration.md) ✅
- [API keys obtained](api-setup.md) ✅

## Related Topics
After completing this guide, you might want to:
- [Configure advanced features](advanced-config.md)
- [Set up monitoring](monitoring.md)
- [Deploy to production](deployment.md)
```

## Quality Assurance Checklist

### Content Review
- [ ] Clear, concise language used
- [ ] Technical accuracy verified
- [ ] No broken internal links
- [ ] All code examples tested
- [ ] Screenshots current and relevant

### Formatting Review
- [ ] Consistent heading hierarchy
- [ ] Proper emoji usage
- [ ] Code blocks properly formatted
- [ ] Tables properly aligned
- [ ] Lists use parallel structure

### Accessibility Review
- [ ] Descriptive link text
- [ ] Alt text for all images
- [ ] Logical heading structure
- [ ] Sufficient color contrast
- [ ] Screen reader friendly

### User Experience Review
- [ ] Clear navigation path
- [ ] Appropriate document length
- [ ] Scannable content structure
- [ ] Actionable instructions
- [ ] Verification steps included

## Style Guide Maintenance

### Regular Updates
- **Monthly**: Review consistency across documents
- **Quarterly**: Update based on user feedback
- **On changes**: Communicate updates to team
- **Annual**: Comprehensive style guide review

### Team Training
- New team members receive style guide training
- Regular refreshers for existing team
- Style guide violations addressed in reviews
- Examples updated to reflect current standards

### Tool Integration
- Use prettier for markdown formatting
- Implement automated link checking
- Set up spell checking in CI/CD
- Use consistent markdown linting rules

This style guide ensures our documentation maintains professional standards while serving users effectively across our multi-agent observability system.