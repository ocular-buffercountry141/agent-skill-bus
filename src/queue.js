/**
 * Prompt Request Bus — Queue Manager
 * 
 * JSONL-based task queue with DAG dependency resolution and file-level locking.
 * Zero dependencies. Framework-agnostic.
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

// ── JSONL helpers ──

export function readJsonl(filePath) {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, 'utf-8').trim();
  if (!content) return [];
  return content.split('\n').filter(Boolean).map(line => JSON.parse(line));
}

export function writeJsonl(filePath, entries) {
  writeFileSync(filePath, entries.map(e => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : ''));
}

export function appendJsonl(filePath, entry) {
  appendFileSync(filePath, JSON.stringify(entry) + '\n');
}

// ── Queue ──

export class PromptRequestQueue {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.queueFile = join(dataDir, 'prompt-request-queue.jsonl');
    this.locksFile = join(dataDir, 'active-locks.jsonl');
    this.dagFile = join(dataDir, 'dag-state.jsonl');
    this.historyFile = join(dataDir, 'prompt-request-history.md');
  }

  /** Read all PRs */
  readAll() {
    return readJsonl(this.queueFile);
  }

  /** Add a new Prompt Request */
  enqueue({ source, priority = 'medium', agent, task, context = '', affectedSkills = [], affectedFiles = [], deadline = 'none', dependsOn = [], dagId = null }) {
    // Deduplication: source + agent + task hash
    const existing = this.readAll();
    const isDuplicate = existing.some(pr =>
      pr.source === source && pr.agent === agent && pr.task === task && pr.status === 'queued'
    );
    if (isDuplicate) return null;

    const pr = {
      id: `pr-${Date.now()}-${randomUUID().slice(0, 8)}`,
      ts: new Date().toISOString(),
      source,
      priority,
      agent,
      task,
      context,
      affectedSkills,
      affectedFiles,
      deadline,
      status: 'queued',
      result: null,
      dependsOn,
      dagId,
    };

    appendJsonl(this.queueFile, pr);
    
    // Update DAG state if applicable
    if (dagId) this._updateDagState(dagId);
    
    return pr;
  }

  /** Get next dispatchable PRs (resolved dependencies, no lock conflicts) */
  getDispatchable(maxCount = 5) {
    const all = this.readAll();
    const locks = this.readLocks();
    const lockedFiles = new Set(locks.flatMap(l => l.files));

    // Priority order
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    // Resolve DAG: promote PRs whose dependencies are all done
    const doneIds = new Set(all.filter(pr => pr.status === 'done').map(pr => pr.id));
    const failedIds = new Set(all.filter(pr => pr.status === 'failed').map(pr => pr.id));

    const dispatchable = [];

    for (const pr of all) {
      if (pr.status !== 'queued') continue;

      // Check DAG dependencies
      if (pr.dependsOn.length > 0) {
        const allDone = pr.dependsOn.every(depId => doneIds.has(depId));
        const anyFailed = pr.dependsOn.some(depId => failedIds.has(depId));
        
        if (anyFailed) {
          this._updateStatus(pr.id, 'blocked', 'Dependency failed');
          continue;
        }
        if (!allDone) continue; // Still waiting
      }

      // Check file locks
      if (pr.affectedFiles.length > 0) {
        const hasConflict = pr.affectedFiles.some(f => lockedFiles.has(f));
        if (hasConflict) continue; // Skip, try next cycle
      }

      // Check deadline
      if (pr.deadline === 'immediate' || this._isDeadlineExpired(pr)) {
        // Critical or expired — still dispatch but flag
      }

      dispatchable.push(pr);
    }

    // Sort by priority, then timestamp
    dispatchable.sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 2;
      const pb = priorityOrder[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(a.ts) - new Date(b.ts);
    });

    return dispatchable.slice(0, maxCount);
  }

  /** Acquire locks for a PR and set it to running */
  startExecution(prId) {
    const all = this.readAll();
    const pr = all.find(p => p.id === prId);
    if (!pr) throw new Error(`PR not found: ${prId}`);

    // Acquire file locks
    if (pr.affectedFiles.length > 0) {
      const lock = {
        agent: pr.agent,
        files: pr.affectedFiles,
        prId: pr.id,
        lockedAt: new Date().toISOString(),
        ttl: 7200,
      };
      appendJsonl(this.locksFile, lock);
    }

    this._updateStatus(prId, 'running');
    return pr;
  }

  /** Complete a PR */
  complete(prId, result = 'done') {
    this._updateStatus(prId, 'done', result);
    this._releaseLock(prId);
    
    // Check if any DAG successors can be promoted
    const all = this.readAll();
    const pr = all.find(p => p.id === prId);
    if (pr?.dagId) this._updateDagState(pr.dagId);

    // Append to history
    if (pr) {
      const line = `- **${pr.ts}** [${pr.source}] ${pr.task} → ${result}\n`;
      appendFileSync(this.historyFile, line);
    }
  }

  /** Fail a PR */
  fail(prId, reason = 'unknown error') {
    this._updateStatus(prId, 'failed', reason);
    this._releaseLock(prId);

    const all = this.readAll();
    const pr = all.find(p => p.id === prId);
    if (pr?.dagId) this._updateDagState(pr.dagId);
  }

  // ── Locks ──

  readLocks() {
    return readJsonl(this.locksFile);
  }

  /** Release expired locks (TTL-based) */
  releaseExpiredLocks() {
    const locks = this.readLocks();
    const now = Date.now();
    const active = [];
    const expired = [];

    for (const lock of locks) {
      const lockTime = new Date(lock.lockedAt).getTime();
      if (now - lockTime > (lock.ttl || 7200) * 1000) {
        expired.push(lock);
      } else {
        active.push(lock);
      }
    }

    if (expired.length > 0) {
      writeJsonl(this.locksFile, active);
      // Mark expired PRs as failed
      for (const lock of expired) {
        this._updateStatus(lock.prId, 'failed', 'lock_timeout');
      }
    }

    return { released: expired.length, active: active.length };
  }

  // ── DAG ──

  getDagState(dagId) {
    const dags = readJsonl(this.dagFile);
    return dags.find(d => d.dagId === dagId);
  }

  /** Create a DAG from a set of tasks */
  createDag(dagId, tasks) {
    const prs = [];
    for (const t of tasks) {
      const pr = this.enqueue({ ...t, dagId });
      if (pr) prs.push(pr);
    }
    this._updateDagState(dagId);
    return prs;
  }

  // ── Stats ──

  stats() {
    const all = this.readAll();
    const locks = this.readLocks();
    const byStatus = {};
    for (const pr of all) {
      byStatus[pr.status] = (byStatus[pr.status] || 0) + 1;
    }
    return {
      total: all.length,
      byStatus,
      activeLocks: locks.length,
    };
  }

  // ── Internal ──

  _updateStatus(prId, status, result) {
    const all = this.readAll();
    const updated = all.map(pr => {
      if (pr.id === prId) return { ...pr, status, result: result ?? pr.result };
      return pr;
    });
    writeJsonl(this.queueFile, updated);
  }

  _releaseLock(prId) {
    const locks = this.readLocks();
    const remaining = locks.filter(l => l.prId !== prId);
    writeJsonl(this.locksFile, remaining);
  }

  _updateDagState(dagId) {
    const all = this.readAll().filter(pr => pr.dagId === dagId);
    if (all.length === 0) return;

    const state = {
      dagId,
      updated: new Date().toISOString(),
      total: all.length,
      queued: all.filter(pr => pr.status === 'queued').length,
      running: all.filter(pr => pr.status === 'running').length,
      done: all.filter(pr => pr.status === 'done').length,
      failed: all.filter(pr => pr.status === 'failed').length,
      blocked: all.filter(pr => pr.status === 'blocked').length,
    };

    const dags = readJsonl(this.dagFile);
    const idx = dags.findIndex(d => d.dagId === dagId);
    if (idx >= 0) dags[idx] = state;
    else dags.push(state);
    writeJsonl(this.dagFile, dags);
  }

  _isDeadlineExpired(pr) {
    if (!pr.deadline || pr.deadline === 'none') return false;
    // Simple deadline checks
    const now = Date.now();
    const created = new Date(pr.ts).getTime();
    const deadlines = { immediate: 0, '24h': 86400000, 'week-end': 604800000 };
    const limit = deadlines[pr.deadline];
    if (limit === undefined) return false;
    return now - created > limit;
  }
}
