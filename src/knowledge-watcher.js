/**
 * Knowledge Watcher — External Change Detector
 * 
 * Monitors knowledge sources, detects diffs, assesses impact, generates PRs.
 * Zero dependencies. Framework-agnostic.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readJsonl, appendJsonl } from './queue.js';

export class KnowledgeWatcher {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.stateFile = join(dataDir, 'knowledge-state.json');
    this.diffsFile = join(dataDir, 'knowledge-diffs.jsonl');
  }

  /** Read current state */
  readState() {
    if (!existsSync(this.stateFile)) return { lastCheck: '', sources: {} };
    return JSON.parse(readFileSync(this.stateFile, 'utf-8'));
  }

  /** Update a source's state */
  updateSource(sourceId, newState) {
    const state = this.readState();
    const oldState = state.sources[sourceId];
    state.sources[sourceId] = {
      ...newState,
      checkedAt: new Date().toISOString(),
    };
    state.lastCheck = new Date().toISOString();
    writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    return { old: oldState, new: state.sources[sourceId] };
  }

  /** Record a detected diff */
  recordDiff({ source, type, detail, affectedSkills = [], severity = 'medium' }) {
    const diff = {
      ts: new Date().toISOString(),
      source,
      type,
      detail,
      affectedSkills,
      severity,
      processed: false,
    };
    appendJsonl(this.diffsFile, diff);
    return diff;
  }

  /** Get unprocessed diffs */
  getUnprocessed() {
    const diffs = readJsonl(this.diffsFile);
    return diffs.filter(d => !d.processed);
  }

  /** Get diffs by severity */
  getBySeverity(severity) {
    const diffs = readJsonl(this.diffsFile);
    return diffs.filter(d => d.severity === severity);
  }

  /** Mark diffs as processed */
  markProcessed(diffIndices) {
    const diffs = readJsonl(this.diffsFile);
    const indexSet = new Set(diffIndices);
    const updated = diffs.map((d, i) => indexSet.has(i) ? { ...d, processed: true } : d);
    writeFileSync(this.diffsFile, updated.map(d => JSON.stringify(d)).join('\n') + (updated.length ? '\n' : ''));
  }

  /** Run a check against a source. User provides the checker function. */
  async check(sourceId, checkerFn) {
    const state = this.readState();
    const previousState = state.sources[sourceId] || {};
    
    // Run the user-provided checker
    const currentState = await checkerFn(previousState);
    
    if (!currentState) return null; // No change or check failed

    // Detect diffs
    const diffs = [];
    if (currentState.version && previousState.version && currentState.version !== previousState.version) {
      const diff = this.recordDiff({
        source: sourceId,
        type: 'version_change',
        detail: `${previousState.version} → ${currentState.version}`,
        affectedSkills: currentState.affectedSkills || ['*'],
        severity: currentState.severity || 'medium',
      });
      diffs.push(diff);
    }

    if (currentState.customDiffs) {
      for (const cd of currentState.customDiffs) {
        const diff = this.recordDiff({ source: sourceId, ...cd });
        diffs.push(diff);
      }
    }

    // Update state
    this.updateSource(sourceId, currentState);

    return { sourceId, diffs, previousState, currentState };
  }

  /** Summary stats */
  stats() {
    const diffs = readJsonl(this.diffsFile);
    const state = this.readState();
    return {
      sources: Object.keys(state.sources).length,
      totalDiffs: diffs.length,
      unprocessed: diffs.filter(d => !d.processed).length,
      bySeverity: {
        critical: diffs.filter(d => d.severity === 'critical').length,
        high: diffs.filter(d => d.severity === 'high').length,
        medium: diffs.filter(d => d.severity === 'medium').length,
        low: diffs.filter(d => d.severity === 'low').length,
      },
    };
  }
}
