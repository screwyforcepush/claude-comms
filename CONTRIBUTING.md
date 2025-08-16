# Contributing to Claude Code Multi-Agent Observability System

Thank you for your interest in contributing to this project! This guide will help you get started with contributing to the Claude Code Multi-Agent Observability & Communication System.

## 🚀 Quick Start

1. **Fork the repository** and clone your fork
2. **Install dependencies**: Follow the [Installation Guide](docs/project/guides/installation-guide.md)
3. **Start the system**: Run `./scripts/start-system.sh`
4. **Make your changes** following our guidelines below
5. **Test thoroughly** using our testing framework
6. **Submit a pull request** with a clear description

## 📋 Development Setup

### Prerequisites

- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** - Anthropic's official CLI
- **[Astral uv](https://docs.astral.sh/uv/)** - Python package manager for hooks
- **[Bun](https://bun.sh/)** or npm/yarn - JavaScript runtime
- **API Keys** - Anthropic (required), OpenAI/ElevenLabs (optional)

### Local Development

```bash
# Clone your fork
git clone https://github.com/yourusername/claude-code-hooks-multi-agent-observability.git
cd claude-code-hooks-multi-agent-observability

# Set up environment
cp .env.sample .env
# Edit .env with your API keys

# Install dependencies and start
./scripts/start-system.sh

# Run tests
./scripts/test-system.sh
```

## 🏗️ Project Structure

```
├── apps/
│   ├── client/          # Vue 3 dashboard frontend
│   └── server/          # Bun TypeScript backend
├── docs/
│   ├── project/guides/  # Technical documentation
│   └── project/spec/    # Requirements & specifications
├── scripts/             # System management scripts
└── .claude/             # Hook integration files
```

## 🛠️ Contribution Types

### 🐛 Bug Fixes
- Check existing issues before creating new ones
- Include reproduction steps and system information
- Write tests that verify the fix
- Update documentation if needed

### ✨ New Features
- Discuss major features in an issue first
- Follow the existing architecture patterns
- Include comprehensive tests
- Update relevant documentation
- Consider backward compatibility

### 📚 Documentation
- Keep documentation in sync with code changes
- Follow the existing documentation structure
- Use clear, concise language
- Include code examples where helpful

### 🧪 Testing
- Write tests for new functionality
- Maintain or improve test coverage
- Follow existing test patterns
- Include both unit and integration tests

## 📝 Coding Standards

### TypeScript/JavaScript
- Use TypeScript for type safety
- Follow existing ESLint configuration
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Prefer functional programming patterns

### Vue.js Components
- Use Composition API with `<script setup>`
- Follow Vue 3 best practices
- Include TypeScript types for props and emits
- Use Tailwind CSS for styling
- Write component tests

### Python Hook Scripts
- Follow PEP 8 style guidelines
- Use type hints where appropriate
- Include docstrings for functions
- Handle errors gracefully
- Test with various Python versions

## 🧪 Testing Guidelines

### Running Tests
```bash
# Full test suite
./scripts/test-system.sh

# Client tests only
cd apps/client && npm test

# Server tests only  
cd apps/server && bun test

# E2E tests
cd apps/client && npx playwright test
```

### Test Requirements
- All new features must include tests
- Bug fixes should include regression tests
- Maintain >80% test coverage
- Test both happy path and error scenarios
- Include visual regression tests for UI changes

### Test Categories
- **Unit Tests**: Individual function/component testing
- **Integration Tests**: Component interaction testing
- **E2E Tests**: Full user workflow testing
- **Visual Tests**: UI screenshot comparison

## 📋 Pull Request Process

### Before Submitting
1. **Update your branch** with the latest main
2. **Run the full test suite** and ensure all tests pass
3. **Check code quality** with linting tools
4. **Update documentation** for any API changes
5. **Add/update tests** for your changes

### PR Requirements
- **Clear title** summarizing the change
- **Detailed description** explaining what and why
- **Link related issues** using GitHub keywords
- **Include screenshots** for UI changes
- **List breaking changes** if any

### Review Process
1. **Automated checks** must pass (tests, linting, build)
2. **Code review** by project maintainers
3. **Documentation review** for accuracy
4. **Manual testing** of new features
5. **Approval and merge** by maintainers

## 🌟 Code Review Guidelines

### For Contributors
- **Self-review** your code before submitting
- **Be responsive** to feedback and questions
- **Make requested changes** promptly
- **Test thoroughly** after making changes

### For Reviewers
- **Be constructive** and specific in feedback
- **Focus on code quality** and maintainability
- **Check test coverage** and documentation
- **Verify backward compatibility**

## 📚 Documentation Standards

### File Organization
- **Source of Truth**: `docs/project/spec/` - Requirements that don't change
- **Living Documentation**: `docs/project/guides/` - Architecture, patterns, ADRs
- **Implementation Notes**: `docs/project/phases/` - Phase-specific working docs

### Writing Guidelines
- Use clear, concise language
- Include code examples
- Keep documentation up-to-date
- Link related documentation
- Use consistent formatting

## 🔒 Security Guidelines

### Reporting Security Issues
- **Do not** create public issues for security vulnerabilities
- **Email maintainers** directly with details
- **Include** reproduction steps and potential impact
- **Allow time** for proper investigation and fixes

### Security Best Practices
- Validate all user inputs
- Use secure communication protocols
- Keep dependencies updated
- Follow OWASP guidelines
- Include security tests

## 🤝 Community Guidelines

### Code of Conduct
- **Be respectful** and inclusive
- **Welcome newcomers** and help them learn
- **Focus on constructive** discussion
- **Respect different** opinions and approaches

### Getting Help
- **Check documentation** first
- **Search existing issues** before creating new ones
- **Provide context** when asking questions
- **Be patient** and appreciative of volunteer help

### Communication Channels
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Pull Requests**: Code contributions and reviews

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the [MIT License](LICENSE).

## 🙏 Recognition

Contributors are recognized in our project documentation and release notes. We appreciate all forms of contribution, from code to documentation to bug reports!

---

**Questions?** Feel free to open an issue or start a discussion. We're here to help!