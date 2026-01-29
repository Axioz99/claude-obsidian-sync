/**
 * Claude Obsidian Sync - 类型定义
 *
 * 定义 Obsidian 同步所需的所有类型接口
 */

/**
 * Obsidian 同步配置
 */
export interface ObsidianSyncConfig {
  /** 是否启用同步 */
  enabled: boolean;
  /** Obsidian vault 绝对路径 */
  vaultPath: string;
  /** 基础文件夹名称，默认 "ClaudeCode" */
  baseFolder: string;
  /** 是否同步观察记录 */
  syncObservations: boolean;
  /** 是否同步会话摘要 */
  syncSummaries: boolean;
}

/**
 * 观察记录数据结构
 * 对应 Claude-Mem 的 ParsedObservation
 */
export interface Observation {
  /** 观察类型: bugfix, feature, refactor, change, discovery, decision */
  type: string;
  /** 观察标题 */
  title: string | null;
  /** 副标题 */
  subtitle: string | null;
  /** 事实列表 */
  facts: string[];
  /** 叙述文本 */
  narrative: string | null;
  /** 概念标签列表 */
  concepts: string[];
  /** 读取的文件列表 */
  files_read: string[];
  /** 修改的文件列表 */
  files_modified: string[];
}

/**
 * 会话摘要数据结构
 */
export interface Summary {
  /** 用户请求的简短标题 */
  request: string;
  /** 已调查的内容 */
  investigated: string;
  /** 学到的知识 */
  learned: string;
  /** 完成的工作 */
  completed: string;
  /** 下一步计划 */
  next_steps: string;
  /** 额外备注 */
  notes: string | null;
}

/**
 * 观察记录元数据
 */
export interface ObservationMetadata {
  /** 观察 ID */
  id: number;
  /** 会话 ID */
  sessionId: string;
  /** 项目名称 */
  project: string;
  /** 提示编号 */
  promptNumber: number;
  /** 创建时间戳 (Unix epoch) */
  createdAtEpoch: number;
}

/**
 * 摘要元数据
 */
export interface SummaryMetadata {
  /** 摘要 ID */
  id: number;
  /** 会话 ID */
  sessionId: string;
  /** 项目名称 */
  project: string;
  /** 提示编号 */
  promptNumber: number;
  /** 创建时间戳 (Unix epoch) */
  createdAtEpoch: number;
}

/**
 * 同步结果
 */
export interface SyncResult {
  /** 是否成功 */
  success: boolean;
  /** 写入的文件路径 */
  filePath?: string;
  /** 错误信息 */
  error?: string;
}
