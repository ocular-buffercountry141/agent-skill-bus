# 🚌 Agent Skill Bus

**A self-improving task orchestration framework for AI agent systems.**

Built by [合同会社みやび (LLC Miyabi)](https://miyabi-ai.jp) — Running 42 AI agents in production daily.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What is this?

Agent Skill Bus is a framework-agnostic toolkit for orchestrating, monitoring, and self-improving AI agent skills. It consists of three integrated modules:

| Module | Purpose | Standalone? |
|--------|---------|-------------|
| **Prompt Request Bus** | DAG-based task queue with dependency resolution & file locking | ✅ Yes |
| **Self-Improving Skills** | Automatic skill quality monitoring & repair loop | ✅ Yes |
| **Knowledge Watcher** | External change detection → automatic improvement triggers | ✅ Yes |

They work independently, but together they form a **closed-loop self-improving agent system**:

```
External Changes ──→ Knowledge Watcher ──→ Prompt Request Bus ──→ Execute
                                                ↑                    │
                                                │                    ↓
                                          Self-Improving ←── Skill Runs Log
                                             Skills
```

## Why?

Most agent frameworks handle **execution** (LangGraph, CrewAI, AutoGen). None handle **operational health**:

- 🔴 **Skills silently degrade** — An API changes, a model updates, auth expires. Nobody notices until it fails in production.
- 🔴 **Tasks collide** — Two agents edit the same file simultaneously. Data corruption.
- 🔴 **No dependency management** — Complex tasks need A→B→C ordering. Most systems just run everything in parallel.
- 🔴 **No learning loop** — Failures repeat because there's no feedback mechanism.

Agent Skill Bus solves all four.

## Quick Start

### 1. Copy the skills you need

```bash
# All three (recommended)
cp -r skills/prompt-request-bus your-workspace/skills/
cp -r skills/self-improving-skills your-workspace/skills/
cp -r skills/knowledge-watcher your-workspace/skills/

# Or just one
cp -r skills/prompt-request-bus your-workspace/skills/
```

### 2. Initialize data files

```bash
# Prompt Request Bus
touch your-workspace/skills/prompt-request-bus/prompt-request-queue.jsonl
touch your-workspace/skills/prompt-request-bus/active-locks.jsonl
echo '{}' > your-workspace/skills/prompt-request-bus/dag-state.jsonl

# Self-Improving Skills
touch your-workspace/skills/self-improving-skills/skill-runs.jsonl
echo '{"lastUpdated":"","skills":{}}' > your-workspace/skills/self-improving-skills/skill-health.json

# Knowledge Watcher
echo '{"lastCheck":"","sources":{}}' > your-workspace/skills/knowledge-watcher/knowledge-state.json
touch your-workspace/skills/knowledge-watcher/knowledge-diffs.jsonl
```

### 3. Start logging skill runs

After any skill execution in your agent, append a line:

```jsonl
{"ts":"2026-03-18T08:00:00Z","agent":"my-agent","skill":"web-search","task":"search query","result":"success","score":1.0,"notes":""}
```

That's it. The self-improving loop will pick it up.

## Modules

### 📬 Prompt Request Bus

A JSONL-based task queue with:

- **DAG dependency resolution** — Tasks specify `dependsOn` other tasks. Automatic topological execution.
- **File-level locking** — Prevent two agents from editing the same file. TTL-based deadlock prevention.
- **Priority routing** — `critical > high > medium > low`. Critical tasks bypass the queue.
- **Multi-source ingestion** — Human commands, cron jobs, GitHub webhooks, internal triggers all use the same format.
- **Deduplication** — Same task won't be queued twice.

```json
{
  "id": "pr-001",
  "ts": "2026-03-18T08:00:00Z",
  "source": "human",
  "priority": "high",
  "agent": "dev-agent",
  "task": "Fix authentication bug in auth.ts",
  "status": "queued",
  "dependsOn": [],
  "affectedFiles": ["myapp:src/auth.ts"],
  "dagId": null
}
```

[Full documentation →](skills/prompt-request-bus/SKILL.md)

### 🔄 Self-Improving Skills

A 7-step quality loop inspired by [Cognee's self-improving agents](https://www.cognee.ai):

```
OBSERVE → ANALYZE → DIAGNOSE → PROPOSE → EVALUATE → APPLY → RECORD
```

- **Automatic failure detection** — Score drops, trend analysis, consecutive failure alerts.
- **LLM-powered diagnosis** — Reads the failing skill + error logs, identifies root cause.
- **Safe auto-repair** — Low-risk fixes applied automatically. High-risk changes need human approval.
- **Drift detection** — Catches silent degradation (score drops >15% week-over-week).

[Full documentation →](skills/self-improving-skills/SKILL.md)

### 👁️ Knowledge Watcher

Monitors external changes and triggers improvement requests:

- **Tier 1 (every check):** Dependency versions, API changes, config drift
- **Tier 2 (daily):** Community patterns, user feedback, platform changes
- **Tier 3 (weekly):** Industry trends, competitor releases, best practice updates

When a change is detected:
1. Assess impact on existing skills
2. Generate a Prompt Request with severity rating
3. Route to Self-Improving Skills or human reviewer

[Full documentation →](skills/knowledge-watcher/SKILL.md)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Agent Skill Bus                     │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   Knowledge   │  │    Prompt    │  │   Self-   │ │
│  │   Watcher     │──│   Request    │──│ Improving │ │
│  │   (detect)    │  │   Bus (route)│  │  (repair) │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│         │                  │                │       │
│         └──────────────────┼────────────────┘       │
│                            │                        │
│               ┌────────────┴────────────┐           │
│               │  JSONL Data Layer       │           │
│               │  • queue.jsonl          │           │
│               │  • skill-runs.jsonl     │           │
│               │  • knowledge-diffs.jsonl│           │
│               │  • active-locks.jsonl   │           │
│               └─────────────────────────┘           │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
              Your Agent Framework
         (OpenClaw, LangGraph, CrewAI,
          Claude Code, Codex, custom...)
```

## Framework Compatibility

Agent Skill Bus is **framework-agnostic**. It uses plain JSONL files as the data layer — no databases, no message brokers, no vendor lock-in.

| Framework | Integration | Notes |
|-----------|------------|-------|
| **OpenClaw** | Native | Built and battle-tested here |
| **Claude Code** | Via Skills | Drop into `.claude/skills/` |
| **Codex** | Via Skills | Drop into `.codex/skills/` |
| **LangGraph** | Via tool calls | Read/write JSONL in tool functions |
| **CrewAI** | Via tool calls | Same approach |
| **Custom** | Direct file I/O | It's just JSONL files |

## Production Stats

This framework runs in production at 合同会社みやび:

- **42 AI agents** coordinated daily
- **27 tasks/day** average throughput
- **44 cron jobs** feeding the bus
- **7-minute security incident response** (fastest recorded)
- **57% reduction in skill failures** after enabling self-improvement loop

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — See [LICENSE](LICENSE).

## Built by

**[合同会社みやび (LLC Miyabi)](https://miyabi-ai.jp)**

Building the future of AI agent operations.

- 🐦 [@The_AGI_WAY](https://x.com/The_AGI_WAY)
- 💬 [Discord](https://discord.gg/miyabi)
- 📧 shunsuke.hayashi@miyabi-ai.jp
