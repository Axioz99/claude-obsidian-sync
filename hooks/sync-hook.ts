#!/usr/bin/env node
/**
 * Claude Code Obsidian Sync Hook
 *
 * 这个脚本作为 Claude Code 的 hook 运行，
 * 在工具调用后自动记录观察，在会话结束时生成摘要。
 */

import * as readline from 'node:readline';
import * as path from 'node:path';
import { createObsidianSync } from '../src/index.js';
import { loadConfig, mergeConfig } from './config.js';
import {
  loadSessionState,
  saveSessionState,
  createSessionState,
  clearSessionState,
  cleanupOldStates,
  type SessionState,
  type ObservationRecord,
} from './state.js';
import type { HookInput, ToolUseHookInput, StopHookInput } from './types.js';
import type { Observation, Summary, ObservationMetadata, SummaryMetadata } from '../src/types.js';

// 日志函数
let logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';

function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  if (levels[level] >= levels[logLevel]) {
    const prefix = `[obsidian-sync:${level}]`;
    if (data) {
      console.error(prefix, message, JSON.stringify(data));
    } else {
      console.error(prefix, message);
    }
  }
}

/**
 * 从 stdin 读取 hook 输入
 */
async function readHookInput(): Promise<HookInput | null> {
  return new Promise((resolve) => {
    let data = '';
    const rl = readline.createInterface({
      input: process.stdin,
      terminal: false,
    });

    rl.on('line', (line) => {
      data += line;
    });

    rl.on('close', () => {
      if (!data.trim()) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(data) as HookInput);
      } catch (e) {
        log('error', '解析 hook 输入失败', e);
        resolve(null);
      }
    });

    // 超时处理
    setTimeout(() => {
      rl.close();
    }, 1000);
  });
}

/**
 * 推断观察类型
 */
function inferObservationType(
  toolName: string,
  toolInput: Record<string, unknown>
): ObservationRecord['type'] {
  const filePath = (toolInput.file_path as string) || '';
  const content = (toolInput.content as string) || (toolInput.new_string as string) || '';
  const command = (toolInput.command as string) || '';

  // 根据文件路径推断
  if (filePath.includes('test') || filePath.includes('spec')) {
    return 'change';
  }

  // 根据内容推断
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes('fix') || lowerContent.includes('bug')) {
    return 'bugfix';
  }
  if (lowerContent.includes('refactor')) {
    return 'refactor';
  }

  // 根据命令推断
  if (command.includes('test') || command.includes('npm run')) {
    return 'discovery';
  }

  // 根据工具类型推断
  if (toolName === 'Write') {
    return 'feature';
  }

  return 'change';
}

/**
 * 生成观察标题
 */
function generateObservationTitle(
  toolName: string,
  toolInput: Record<string, unknown>
): string {
  const filePath = (toolInput.file_path as string) || '';
  const fileName = filePath ? path.basename(filePath) : '';

  switch (toolName) {
    case 'Edit':
      return fileName ? `编辑 ${fileName}` : '编辑文件';
    case 'Write':
      return fileName ? `创建 ${fileName}` : '创建文件';
    case 'Bash':
      const cmd = (toolInput.command as string) || '';
      const shortCmd = cmd.length > 30 ? cmd.substring(0, 30) + '...' : cmd;
      return `执行命令: ${shortCmd}`;
    default:
      return `${toolName} 操作`;
  }
}

/**
 * 处理工具使用 hook
 */
async function handleToolUse(
  input: ToolUseHookInput,
  state: SessionState,
  trackedTools: string[]
): Promise<SessionState> {
  const { tool_name, tool_input, tool_output } = input;

  // 检查是否是需要跟踪的工具
  if (!trackedTools.includes(tool_name)) {
    return state;
  }

  log('debug', `处理工具: ${tool_name}`);

  // 更新文件列表
  const filePath = (tool_input.file_path as string) || '';
  if (filePath) {
    if (tool_name === 'Read') {
      if (!state.filesRead.includes(filePath)) {
        state.filesRead.push(filePath);
      }
    } else if (tool_name === 'Edit' || tool_name === 'Write') {
      if (!state.filesModified.includes(filePath)) {
        state.filesModified.push(filePath);
      }
    }
  }

  // 创建观察记录
  const observation: ObservationRecord = {
    id: Date.now(),
    timestamp: Date.now(),
    toolName: tool_name,
    type: inferObservationType(tool_name, tool_input as Record<string, unknown>),
    title: generateObservationTitle(tool_name, tool_input as Record<string, unknown>),
    facts: [],
    filesRead: filePath && tool_name === 'Read' ? [filePath] : [],
    filesModified: filePath && (tool_name === 'Edit' || tool_name === 'Write') ? [filePath] : [],
  };

  // 添加事实
  if (filePath) {
    observation.facts.push(`操作文件: ${filePath}`);
  }
  if (tool_name === 'Bash') {
    const cmd = (tool_input.command as string) || '';
    observation.facts.push(`执行命令: ${cmd}`);
  }

  state.observations.push(observation);
  state.promptCount++;

  return state;
}

/**
 * 处理会话结束 hook
 */
async function handleStop(
  input: StopHookInput,
  state: SessionState,
  config: ReturnType<typeof mergeConfig>
): Promise<void> {
  log('info', '会话结束，开始同步到 Obsidian');

  const sync = createObsidianSync({
    vaultPath: config.vaultPath,
    baseFolder: config.baseFolder,
    syncObservations: config.syncObservations,
    syncSummaries: config.syncSummaries,
  });

  if (!sync.isEnabled()) {
    log('warn', 'Obsidian 同步未启用');
    return;
  }

  const projectName = path.basename(state.projectPath);
  const now = Date.now();

  // 同步观察记录
  if (config.syncObservations && state.observations.length > 0) {
    log('info', `同步 ${state.observations.length} 条观察记录`);

    for (const obs of state.observations) {
      const observation: Observation = {
        type: obs.type,
        title: obs.title,
        subtitle: obs.subtitle ?? null,
        facts: obs.facts,
        narrative: '',
        concepts: [],
        files_read: obs.filesRead,
        files_modified: obs.filesModified,
      };

      const metadata: ObservationMetadata = {
        id: obs.id,
        sessionId: state.sessionId,
        project: projectName,
        promptNumber: state.promptCount,
        createdAtEpoch: obs.timestamp,
      };

      const result = await sync.syncObservation(observation, metadata);
      if (result.success) {
        log('debug', `观察记录已同步: ${result.filePath}`);
      } else {
        log('error', `观察记录同步失败: ${result.error}`);
      }
    }
  }

  // 同步摘要
  if (config.syncSummaries) {
    log('info', '生成会话摘要');

    const summary: Summary = {
      request: input.transcript_summary || '会话任务',
      investigated: state.filesRead.length > 0
        ? `读取了 ${state.filesRead.length} 个文件`
        : '',
      learned: '',
      completed: state.filesModified.length > 0
        ? `修改了 ${state.filesModified.length} 个文件`
        : '',
      next_steps: '',
      notes: `会话包含 ${state.observations.length} 个操作`,
    };

    const metadata: SummaryMetadata = {
      id: now,
      sessionId: state.sessionId,
      project: projectName,
      promptNumber: state.promptCount,
      createdAtEpoch: now,
    };

    const result = await sync.syncSummary(summary, metadata);
    if (result.success) {
      log('info', `摘要已同步: ${result.filePath}`);
    } else {
      log('error', `摘要同步失败: ${result.error}`);
    }
  }

  // 清理会话状态
  await clearSessionState(state.sessionId);
  log('info', 'Obsidian 同步完成');
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  // 清理过期状态
  await cleanupOldStates();

  // 加载配置
  const config = await loadConfig();
  if (!config) {
    log('debug', '未找到配置文件，跳过同步');
    return;
  }

  const mergedConfig = mergeConfig(config);
  logLevel = mergedConfig.logLevel;

  // 读取 hook 输入
  const input = await readHookInput();
  if (!input) {
    log('debug', '无 hook 输入');
    return;
  }

  log('debug', `收到 hook: ${input.hook_type}`);

  // 获取或创建会话状态
  const sessionId = input.session_id;
  const projectPath = input.project_path || input.cwd;
  let state = await loadSessionState(sessionId);

  if (!state) {
    state = createSessionState(sessionId, projectPath);
  }

  // 根据 hook 类型处理
  if (input.hook_type === 'PostToolUse') {
    state = await handleToolUse(
      input as ToolUseHookInput,
      state,
      mergedConfig.trackedTools
    );
    await saveSessionState(state);
  } else if (input.hook_type === 'Stop') {
    await handleStop(input as StopHookInput, state, mergedConfig);
  }
}

// 运行
main().catch((err) => {
  console.error('[obsidian-sync:error] 未捕获的错误:', err);
  process.exit(1);
});
