# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-03-28

### Added
- **AI-powered code review** (`ai-review.yml`) with CRITICAL/WARNING severity split.
- **Copilot auto-fix** for WARNING-level review issues (`auto-merge.yml`).
- **Context Sufficiency Check** in decompose workflow.
- **DESIGN_CONSTRAINTS.md** injection into AI review pipeline.
- **Full Copilot automation pipeline** (4 GitHub Actions workflows).
- 7 new skills: coding-agent-router, context-and-impact, copilot-coding-agent, copilot-full-automation, cursor-agent, devin-agent, manus-agent.
- X auto-posting scheduler skill (5-post daily template).
- note.com auto-publish pipeline skill.
- ScrapeCreators API wrapper skill (27 platforms).
- last30days research skill integration.
- `CLAUDE.md` workspace configuration.
- GitHub Sponsors funding button.
- GitHub issue templates (bug report, feature request, copilot task).

### Changed
- Flagged threshold raised from 0.7 to 0.8 for stricter quality monitoring.
- Improved README SEO positioning and documentation.
- TypeScript type definitions expanded (`types/index.d.ts` — 698 lines).

### Fixed
- Dead `agentskills.bath.me` links replaced with `agentskills.io`.
- Removed incorrect Discord invite link (`discord.gg/miyabi` pointed to wrong server).
- CI: switched to Claude Code OAuth token instead of Anthropic API key.

## [1.3.0] - 2026-03-20

### Added
- **Dashboard command** (`skill-bus dashboard`) — Color-coded terminal view of all skill health, queue stats, trend indicators, and flagged skills.
- `--days N` flag for dashboard analysis window (default: 7).
- `--no-color` flag and `NO_COLOR` env var support for CI/piping.
- CrewAI integration guide (`examples/crewai-integration.md`).

## [1.2.1] - 2026-03-20

### Changed
- Expanded npm keywords for better discoverability.

## [1.2.0] - 2026-03-19

### Added
- Claude Code and LangGraph integration examples.
- TypeScript type definitions (`types/index.d.ts`).
- GitHub Actions CI workflow (Node 22+).
- Comprehensive README with Japanese documentation section.
- npm, CI, zero-deps, and Discussions badges.
- CONTRIBUTING.md with zero-dependencies policy.

### Fixed
- CLI version string synced to match package.json.
- CI: dropped Node 18/20 (glob unsupported), using explicit test paths.

## [1.1.0] - 2026-03-18

### Fixed
- CLI flag parsing for `--agent`, `--skill`, `--task`, `--result`, `--score`.
- Lock verification and TTL expiry logic.
- `init` command now correctly copies SKILL.md templates.

## [1.0.0] - 2026-03-18

### Added
- Initial release.
- **Prompt Request Bus**: JSONL task queue with DAG dependency resolution, file-level locking, priority routing, deduplication.
- **Self-Improving Skills**: 7-step quality loop (OBSERVE → ANALYZE → DIAGNOSE → PROPOSE → EVALUATE → APPLY → RECORD), drift detection, auto-repair.
- **Knowledge Watcher**: Tiered external change detection (dependency, API, community).
- CLI with `init`, `enqueue`, `dispatch`, `record-run`, `analyze`, `flagged`, `run` commands.
- 12 passing tests.
- Zero npm dependencies.

[1.4.0]: https://github.com/ShunsukeHayashi/agent-skill-bus/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/ShunsukeHayashi/agent-skill-bus/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/ShunsukeHayashi/agent-skill-bus/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/ShunsukeHayashi/agent-skill-bus/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/ShunsukeHayashi/agent-skill-bus/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/ShunsukeHayashi/agent-skill-bus/releases/tag/v1.0.0
