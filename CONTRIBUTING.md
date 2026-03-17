# Contributing to Agent Skill Bus

Thanks for your interest! Here's how to contribute.

## Quick Start

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Test with your agent setup
5. Submit a PR

## What We're Looking For

- **Framework integrations** — Examples for LangGraph, CrewAI, AutoGen, etc.
- **New knowledge sources** — Tier 1/2/3 source implementations for Knowledge Watcher
- **Visualization tools** — DAG visualizers, health dashboards
- **Performance improvements** — Better deduplication, faster queue processing
- **Documentation** — Tutorials, guides, translations

## Guidelines

- Keep it framework-agnostic. No vendor lock-in.
- JSONL is the data layer. Don't add database dependencies.
- Test your changes with real agents if possible.
- Follow existing SKILL.md format for new modules.

## Reporting Issues

Open an issue with:
- What you expected
- What happened
- Your agent framework and version
- Relevant JSONL entries (redact sensitive data)

## License

By contributing, you agree that your contributions will be licensed under MIT.
