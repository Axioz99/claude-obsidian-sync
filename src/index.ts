/**
 * Claude Obsidian Sync
 *
 * 将 Claude Code 对话上下文同步到 Obsidian 的独立工具
 *
 * @example
 * ```typescript
 * import { createObsidianSync } from 'claude-obsidian-sync';
 *
 * const sync = createObsidianSync({
 *   vaultPath: 'D:/MyObsidianVault',
 *   baseFolder: 'ClaudeCode'
 * });
 *
 * await sync.syncObservation(observation, metadata);
 * await sync.syncSummary(summary, metadata);
 * ```
 */

// 导出类型
export type {
  ObsidianSyncConfig,
  Observation,
  Summary,
  ObservationMetadata,
  SummaryMetadata,
  SyncResult
} from './types.js';

// 导出同步服务
export { ObsidianSync, createObsidianSync } from './sync.js';

// 导出格式化工具
export {
  formatObservationNote,
  formatSummaryNote,
  formatYearMonth,
  formatIsoDate,
  formatReadableDate,
  sanitizeFileName,
  generateFrontmatter,
  TYPE_EMOJI_MAP
} from './formatter.js';
