# Contributing to LinkedIn Prospects Helper

Thank you for your interest in contributing to LinkedIn Prospects Helper! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/linkedInProspects-helper.git
   cd linkedInProspects-helper
   ```
3. **Set up the development environment** following [INSTALL.md](docs/INSTALL.md)
4. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:

| Prefix | Purpose |
|--------|---------|
| `feature/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation updates |
| `refactor/` | Code refactoring |
| `test/` | Adding or updating tests |

Examples:
- `feature/prospect-import`
- `fix/login-redirect`
- `docs/api-documentation`

### Running the Project

```bash
# Start development server
yarn dev

# Run linting
yarn lint

# Build for production
yarn build
```

## Coding Standards

### Language Rules

> **Important**: All code, comments, and documentation must be written in **English**, regardless of the language used in discussions or issues.

This includes:
- Variable and function names
- Comments and documentation
- Commit messages
- API responses and error messages
- Test descriptions

See [.cursorrules](.cursorrules) for complete coding guidelines.

### TypeScript

- Use TypeScript for all new files
- Define proper types for all function parameters and return values
- Avoid using `any` type
- Export interfaces and types for reuse

```typescript
// Good
interface Prospect {
  id: string;
  name: string;
  linkedInUrl: string;
}

function getProspect(id: string): Promise<Prospect> {
  // ...
}

// Bad
function getProspect(id: any): any {
  // ...
}
```

### React Components

- Use functional components with hooks
- Keep components focused and small
- Use Ant Design components consistently
- Follow Next.js App Router conventions

```typescript
// Good
export function ProspectCard({ prospect }: ProspectCardProps) {
  return (
    <Card title={prospect.name}>
      {/* ... */}
    </Card>
  );
}

// Bad
export default function(props: any) {
  return <div>{props.data.name}</div>;
}
```

### File Organization

```
components/
├── ui/                    # Base UI components
│   ├── Button.tsx
│   └── Card.tsx
├── features/              # Feature-specific components
│   ├── prospects/
│   │   ├── ProspectCard.tsx
│   │   └── ProspectList.tsx
│   └── messages/
└── layout/                # Layout components
    ├── Header.tsx
    └── Sidebar.tsx
```

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
type(scope): description

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, semicolons, etc.) |
| `refactor` | Code changes that neither fix bugs nor add features |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks, dependencies, etc. |

### Examples

```bash
# Feature
git commit -m "feat(prospects): add bulk import functionality"

# Bug fix
git commit -m "fix(auth): resolve LinkedIn callback redirect issue"

# Documentation
git commit -m "docs(readme): update installation instructions"

# With body
git commit -m "feat(dashboard): add prospect analytics widget

- Add weekly prospect count chart
- Add conversion rate metrics
- Implement date range selector"
```

## Pull Request Process

### Before Submitting

1. **Update your branch** with the latest main:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Run linting** and fix any issues:
   ```bash
   yarn lint
   ```

3. **Test your changes** thoroughly

4. **Update documentation** if needed

### PR Title Format

Follow the same convention as commit messages:

```
feat(scope): description
fix(scope): description
docs(scope): description
```

### PR Description Template

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Documentation update
- [ ] Refactoring
- [ ] Other (please describe)

## How to Test
Steps to test the changes:
1. ...
2. ...

## Screenshots (if applicable)
Add screenshots here

## Checklist
- [ ] Code follows the project's coding standards
- [ ] All code and comments are in English
- [ ] Self-review completed
- [ ] Documentation updated (if needed)
- [ ] No new warnings or errors
```

### Review Process

1. Submit your PR
2. Wait for code review
3. Address any feedback
4. Once approved, your PR will be merged

## Reporting Issues

### Bug Reports

When reporting bugs, include:

1. **Description**: Clear description of the issue
2. **Steps to Reproduce**: Numbered steps to reproduce
3. **Expected Behavior**: What you expected to happen
4. **Actual Behavior**: What actually happened
5. **Environment**: Browser, OS, Node version
6. **Screenshots**: If applicable

### Feature Requests

When requesting features, include:

1. **Problem**: What problem does this solve?
2. **Proposed Solution**: How would you implement it?
3. **Alternatives**: Any alternatives you've considered?
4. **Additional Context**: Any other relevant information

## Questions?

If you have questions about contributing, feel free to:

1. Open a GitHub Discussion
2. Check existing issues and PRs
3. Review the documentation

Thank you for contributing! 🎉
