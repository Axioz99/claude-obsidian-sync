/**
 * Claude Obsidian Sync - 同步服务
 *
 * 将 Claude Code 对话上下文同步到 Obsidian vault
 */

import { mkdir, writeFile, access, stat } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import type {
  ObsidianSyncConfig,
  Observation,
  Summary,
  ObservationMetadata,
  SummaryMetadata,
  SyncResult
} from './types.js';
import {
  formatObservationNote,
  formatSummaryNote,
  formatYearMonth,
  sanitizeFileName
} from './formatter.js';

/**
 * 简单的日志接口
 */
interface Logger {
  info(category: string, message: string, data?: Record<string, unknown>): void;
  warn(category: string, message: string, data?: Record<string, unknown>): void;
  error(category: string, message: string, data?: Record<string, unknown>, error?: Error): void;
  debug(category: string, message: string, data?: Record<string, unknown>): void;
}

/**
 * 默认控制台日志实现
 */
const defaultLogger: Logger = {
  info: (cat, msg, data) => console.log(`[${cat}] ${msg}`, data || ''),
  warn: (cat, msg, data) => console.warn(`[${cat}] ${msg}`, data || ''),
  error: (cat, msg, data, err) => console.error(`[${cat}] ${msg}`, data || '', err || ''),
  debug: (cat, msg, data) => console.debug(`[${cat}] ${msg}`, data || '')
};

/**
 * Obsidian 同步服务
 *
 * 使用文件系统直接写入 Markdown 文件到 Obsidian vault
 */
export class ObsidianSync {
  private config: ObsidianSyncConfig;
  private logger: Logger;

  constructor(config: ObsidianSyncConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger || defaultLogger;

    if (config.enabled) {
      this.logger.info('OBSIDIAN', 'ObsidianSync initialized', {
        vaultPath: config.vaultPath,
        baseFolder: config.baseFolder
      });
    }
  }

  /**
   * 检查同步是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled && !!this.config.vaultPath;
  }

  /**
   * 获取配置
   */
  getConfig(): ObsidianSyncConfig {
    return { ...this.config };
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await access(dirPath, constants.F_OK);
    } catch {
      await mkdir(dirPath, { recursive: true });
      this.logger.debug('OBSIDIAN', 'Created directory', { path: dirPath });
    }
  }

  /**
   * 写入笔记文件
   */
  private async writeNote(filePath: string, content: string): Promise<void> {
    await writeFile(filePath, content, 'utf-8');
    this.logger.debug('OBSIDIAN', 'Wrote note', { path: filePath });
  }

  /**
   * 获取观察记录存储路径
   */
  private getObservationsPath(): string {
    const folder = this.config.observationsFolder ?? '观察';
    return path.join(this.config.vaultPath, this.config.baseFolder, folder);
  }

  /**
   * 获取摘要存储路径
   */
  private getSummariesPath(): string {
    const folder = this.config.summariesFolder ?? '摘要';
    return path.join(this.config.vaultPath, this.config.baseFolder, folder);
  }

  /**
   * 同步观察记录到 Obsidian
   */
  async syncObservation(
    observation: Observation,
    metadata: ObservationMetadata
  ): Promise<SyncResult> {
    if (!this.isEnabled() || !this.config.syncObservations) {
      return { success: true, filePath: undefined };
    }

    try {
      // 格式化笔记内容
      const content = formatObservationNote(observation, metadata);

      // 构建文件路径: 观察/YYYY-MM/obs_{id}_{title}.md
      const yearMonth = formatYearMonth(metadata.createdAtEpoch);
      const safeTitle = sanitizeFileName(observation.title);
      const fileName = `obs_${metadata.id}_${safeTitle}.md`;
      const dirPath = path.join(this.getObservationsPath(), yearMonth);
      const filePath = path.join(dirPath, fileName);

      // 确保目录存在并写入文件
      await this.ensureDirectory(dirPath);
      await this.writeNote(filePath, content);

      this.logger.info('OBSIDIAN', 'Observation synced', {
        id: metadata.id,
        type: observation.type,
        title: observation.title || '(untitled)',
        path: filePath
      });

      return { success: true, filePath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('OBSIDIAN', 'Failed to sync observation', {
        id: metadata.id,
        type: observation.type
      }, error instanceof Error ? error : undefined);

      return { success: false, error: errorMessage };
    }
  }

  /**
   * 同步摘要到 Obsidian
   */
  async syncSummary(
    summary: Summary,
    metadata: SummaryMetadata
  ): Promise<SyncResult> {
    if (!this.isEnabled() || !this.config.syncSummaries) {
      return { success: true, filePath: undefined };
    }

    try {
      // 格式化笔记内容
      const content = formatSummaryNote(summary, metadata);

      // 构建文件路径: 摘要/YYYY-MM/sum_{id}_{request}.md
      const yearMonth = formatYearMonth(metadata.createdAtEpoch);
      const safeRequest = sanitizeFileName(summary.request);
      const fileName = `sum_${metadata.id}_${safeRequest}.md`;
      const dirPath = path.join(this.getSummariesPath(), yearMonth);
      const filePath = path.join(dirPath, fileName);

      // 确保目录存在并写入文件
      await this.ensureDirectory(dirPath);
      await this.writeNote(filePath, content);

      this.logger.info('OBSIDIAN', 'Summary synced', {
        id: metadata.id,
        request: summary.request || '(no request)',
        path: filePath
      });

      return { success: true, filePath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('OBSIDIAN', 'Failed to sync summary', {
        id: metadata.id,
        request: summary.request || '(no request)'
      }, error instanceof Error ? error : undefined);

      return { success: false, error: errorMessage };
    }
  }

  /**
   * 批量同步观察记录（并行执行）
   */
  async syncObservations(
    items: Array<{ observation: Observation; metadata: ObservationMetadata }>
  ): Promise<SyncResult[]> {
    const results = await Promise.allSettled(
      items.map(item => this.syncObservation(item.observation, item.metadata))
    );

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        success: false,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason)
      };
    });
  }

  /**
   * 批量同步摘要（并行执行）
   */
  async syncSummaries(
    items: Array<{ summary: Summary; metadata: SummaryMetadata }>
  ): Promise<SyncResult[]> {
    const results = await Promise.allSettled(
      items.map(item => this.syncSummary(item.summary, item.metadata))
    );

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        success: false,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason)
      };
    });
  }
}

/**
 * 创建 ObsidianSync 实例的工厂函数
 * @throws {Error} 如果 vaultPath 无效
 */
export async function createObsidianSync(
  config: Partial<ObsidianSyncConfig> & { vaultPath: string },
  logger?: Logger
): Promise<ObsidianSync> {
  // 验证 vaultPath 存在
  try {
    const stats = await stat(config.vaultPath);
    if (!stats.isDirectory()) {
      throw new Error(`vaultPath 不是目录: ${config.vaultPath}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`vaultPath 不存在: ${config.vaultPath}`);
    }
    throw error;
  }

  const fullConfig: ObsidianSyncConfig = {
    enabled: config.enabled ?? true,
    vaultPath: config.vaultPath,
    baseFolder: config.baseFolder ?? 'ClaudeCode',
    observationsFolder: config.observationsFolder,
    summariesFolder: config.summariesFolder,
    syncObservations: config.syncObservations ?? true,
    syncSummaries: config.syncSummaries ?? true
  };

  return new ObsidianSync(fullConfig, logger);
}
