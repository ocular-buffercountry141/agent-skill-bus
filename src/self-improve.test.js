import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SkillMonitor } from './self-improve.js';

describe('SkillMonitor', () => {
  let tempDir;
  let monitor;

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'skill-monitor-test-'));
    writeFileSync(join(tempDir, 'skill-runs.jsonl'), '');
    writeFileSync(join(tempDir, 'skill-health.json'), '{"lastUpdated":"","skills":{}}');
    writeFileSync(join(tempDir, 'skill-improvements.md'), '# Improvements\n');
    monitor = new SkillMonitor(tempDir);
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should record a skill run', () => {
    const entry = monitor.recordRun({
      agent: 'test-agent',
      skill: 'web-search',
      task: 'search query',
      result: 'success',
      score: 1.0,
    });
    assert.ok(entry.ts);
    assert.strictEqual(entry.skill, 'web-search');
    assert.strictEqual(entry.score, 1.0);
  });

  it('should analyze skill health', () => {
    // Add more runs
    monitor.recordRun({ agent: 'a', skill: 'api-caller', task: 't1', result: 'fail', score: 0.0, notes: '401' });
    monitor.recordRun({ agent: 'a', skill: 'api-caller', task: 't2', result: 'fail', score: 0.0, notes: '401' });
    monitor.recordRun({ agent: 'a', skill: 'api-caller', task: 't3', result: 'fail', score: 0.0, notes: '401' });
    monitor.recordRun({ agent: 'a', skill: 'web-search', task: 't4', result: 'success', score: 0.9 });

    const health = monitor.analyze(30);
    assert.ok(health['api-caller']);
    assert.ok(health['web-search']);
    assert.strictEqual(health['api-caller'].trend, 'broken'); // 3 consecutive fails
    assert.ok(health['api-caller'].flagged);
  });

  it('should get flagged skills', () => {
    const flagged = monitor.getFlagged(30);
    assert.ok(flagged.length > 0);
    assert.ok(flagged.some(s => s.name === 'api-caller'));
  });

  it('should update health file', () => {
    const state = monitor.updateHealth(30);
    assert.ok(state.lastUpdated);
    assert.ok(state.skills['api-caller']);
  });

  it('should clamp scores to [0, 1]', () => {
    const e1 = monitor.recordRun({ agent: 'a', skill: 'test', task: 't', result: 'success', score: 1.5 });
    const e2 = monitor.recordRun({ agent: 'a', skill: 'test', task: 't', result: 'fail', score: -0.5 });
    assert.strictEqual(e1.score, 1.0);
    assert.strictEqual(e2.score, 0.0);
  });
});
