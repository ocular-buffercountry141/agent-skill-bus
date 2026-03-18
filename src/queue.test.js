import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PromptRequestQueue } from './queue.js';

describe('PromptRequestQueue', () => {
  let tempDir;
  let queue;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'skill-bus-test-'));
    for (const f of ['prompt-request-queue.jsonl', 'active-locks.jsonl', 'dag-state.jsonl']) {
      writeFileSync(join(tempDir, f), '');
    }
    writeFileSync(join(tempDir, 'prompt-request-history.md'), '# History\n');
    queue = new PromptRequestQueue(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should enqueue a prompt request', () => {
    const pr = queue.enqueue({
      source: 'human',
      priority: 'high',
      agent: 'dev',
      task: 'Fix auth bug',
    });
    assert.ok(pr);
    assert.ok(pr.id.startsWith('pr-'));
    assert.strictEqual(pr.status, 'queued');
    assert.strictEqual(pr.priority, 'high');
  });

  it('should deduplicate identical requests', () => {
    const pr1 = queue.enqueue({ source: 'test', agent: 'dev', task: 'same task' });
    const pr2 = queue.enqueue({ source: 'test', agent: 'dev', task: 'same task' });
    assert.ok(pr1);
    assert.strictEqual(pr2, null);
  });

  it('should return dispatchable PRs sorted by priority', () => {
    queue.enqueue({ source: 'a', priority: 'low', agent: 'a', task: 'low task' });
    queue.enqueue({ source: 'b', priority: 'critical', agent: 'b', task: 'critical task' });
    queue.enqueue({ source: 'c', priority: 'medium', agent: 'c', task: 'medium task' });

    const dispatchable = queue.getDispatchable();
    assert.strictEqual(dispatchable[0].priority, 'critical');
    assert.strictEqual(dispatchable[1].priority, 'medium');
    assert.strictEqual(dispatchable[2].priority, 'low');
  });

  it('should handle DAG dependencies', () => {
    const pr1 = queue.enqueue({ source: 'dag1', agent: 'a', task: 'step 1', dagId: 'test-dag' });
    const pr2 = queue.enqueue({ source: 'dag2', agent: 'a', task: 'step 2', dependsOn: [pr1.id], dagId: 'test-dag' });

    // Only pr1 should be dispatchable
    let dispatchable = queue.getDispatchable();
    assert.strictEqual(dispatchable.length, 1);
    assert.strictEqual(dispatchable[0].id, pr1.id);

    // Complete pr1 → pr2 should become dispatchable
    queue.startExecution(pr1.id);
    queue.complete(pr1.id, 'done');

    dispatchable = queue.getDispatchable();
    assert.strictEqual(dispatchable.length, 1);
    assert.strictEqual(dispatchable[0].id, pr2.id);
  });

  it('should manage file locks', () => {
    const pr1 = queue.enqueue({ source: 'lock1', agent: 'a', task: 'edit file', affectedFiles: ['repo:src/main.ts'] });
    queue.startExecution(pr1.id);

    const locks = queue.readLocks();
    assert.strictEqual(locks.length, 1);
    assert.deepStrictEqual(locks[0].files, ['repo:src/main.ts']);

    // PR2 targeting same file should not be dispatchable
    queue.enqueue({ source: 'lock2', agent: 'b', task: 'also edit file', affectedFiles: ['repo:src/main.ts'] });
    const dispatchable = queue.getDispatchable();
    assert.strictEqual(dispatchable.length, 0);

    // Complete pr1 → lock released → pr2 dispatchable
    queue.complete(pr1.id);
    const dispatchable2 = queue.getDispatchable();
    assert.strictEqual(dispatchable2.length, 1);
  });

  it('should block PRs when dependency fails', () => {
    const pr1 = queue.enqueue({ source: 'f1', agent: 'a', task: 'step 1', dagId: 'fail-dag' });
    queue.enqueue({ source: 'f2', agent: 'a', task: 'step 2', dependsOn: [pr1.id], dagId: 'fail-dag' });

    queue.startExecution(pr1.id);
    queue.fail(pr1.id, 'crashed');

    // Try to dispatch — pr2 should be blocked
    const dispatchable = queue.getDispatchable();
    assert.strictEqual(dispatchable.length, 0);

    // Verify pr2 is blocked
    const all = queue.readAll();
    const pr2 = all.find(p => p.task === 'step 2');
    assert.strictEqual(pr2.status, 'blocked');
  });

  it('should reject startExecution when files are already locked', () => {
    const pr1 = queue.enqueue({ source: 'r1', agent: 'a', task: 'edit main', affectedFiles: ['src/main.ts'] });
    const pr2 = queue.enqueue({ source: 'r2', agent: 'b', task: 'also edit main', affectedFiles: ['src/main.ts'] });

    queue.startExecution(pr1.id);

    // pr2 should throw on start because src/main.ts is locked
    assert.throws(() => {
      queue.startExecution(pr2.id);
    }, /Lock conflict/);
  });

  it('should return stats', () => {
    queue.enqueue({ source: 's1', agent: 'a', task: 'task 1' });
    queue.enqueue({ source: 's2', agent: 'b', task: 'task 2' });
    const stats = queue.stats();
    assert.strictEqual(stats.total, 2);
    assert.strictEqual(stats.byStatus.queued, 2);
  });
});
