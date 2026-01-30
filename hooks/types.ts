/**
 * Claude Code Hooks 类型定义
 */

// Hook 事件类型
export type HookType = 'PreToolUse' | 'PostToolUse' | 'Notification' | 'Stop';

// 工具使用 Hook 输入
export interface ToolUseHookInput {
  hook_type: 'PreToolUse' | 'PostToolUse';
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output?: unknown;
  session_id: string;
  cwd: string;
  project_path?: string;
}

// Stop Hook 输入
export interface StopHookInput {
  hook_type: 'Stop';
  session_id: string;
  cwd: string;
  project_path?: string;
  stop_reason: string;
  transcript_summary?: string;
}

// 通用 Hook 输入
export type HookInput = ToolUseHookInput | StopHookInput;

// Hook 配置
export interface HookConfig {
  // Obsidian vault 路径
  vaultPath: string;
  // 基础文件夹
  baseFolder?: string;
  // 是否启用观察记录同步
  syncObservations?: boolean;
  // 是否启用摘要同步
  syncSummaries?: boolean;
  // 要跟踪的工具列表
  trackedTools?: string[];
  // 日志级别
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}
