# Agent Skill Bus

## For Claude Code / Codex Users

Drop the `skills/` directory into your workspace:

```bash
npx agent-skill-bus init
```

Or copy manually:
```bash
cp -r node_modules/agent-skill-bus/skills/ your-project/skills/
```

## CLI Usage

After any skill execution, record it:
```bash
npx agent-skill-bus record-run --agent my-agent --skill api-caller --task "fetch data" --result success --score 1.0
```

Check skill health:
```bash
npx agent-skill-bus health
npx agent-skill-bus flagged
npx agent-skill-bus drift
```

Manage task queue:
```bash
npx agent-skill-bus enqueue --source human --priority high --agent dev --task "Fix auth bug"
npx agent-skill-bus dispatch
npx agent-skill-bus complete <pr-id>
```

## Integration with Claude Code

Add to your AGENTS.md or project instructions:

> After completing any task, log the result:
> `npx agent-skill-bus record-run --agent claude --skill <skill-name> --task "<what you did>" --result <success|fail|partial> --score <0.0-1.0>`

This enables the self-improving loop to detect degradation and suggest fixes.
