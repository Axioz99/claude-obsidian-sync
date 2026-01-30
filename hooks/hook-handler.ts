#!/usr/bin/env npx ts-node
/**
 * Claude Code Hook Handler
 *
 * 监听 Claude Code 的工具调用事件，自动同步到 Obsidian
 *
 * 使用方法：
 * 1. 配置 .claude/settings.json 中的 hooks
 * 2. 当 Claude Code 执行工具时，此脚本会被调用
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadConfig, mergeConfig } from './config';
import {
  loadSessionState,
  saveSessionState,
  createSessionState,
  cleanupOldStates,
  type SessionState,
  type ObservationRecord
} from './state';
import type { HookInput, ToolUseHookInput, StopHookInput } from './types';

// 静默日志（不输出到 stdout，避免干扰 Claude Code）
const LOG_FILE = path.join(os.tmpdir(), 'claude-obsidian-sync', 'hook.log');

async function log(level: string, message: string, data?: unknown): Promise<void> {
  try {
    const logDir = path.dirname(LOG_FILE);
    await fs.mkdir(logDir, { recursive: true });
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] ${message} ${data ? JSON.stringify(data) : ''}\n`;
    await fs.appendFile(LOG_FILE, logLine);
  } catch (error) {
    // 日志失败时输出到 stderr（不影响 Claude Code）
    console.error('[obsidian-sync] 日志写入失败:', error);
  }
}

/**
 * 从 stdin 读取输入
 */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * 获取项目名称
 */
function getProjectName(projectPath: string | undefined, cwd: string): string {
  const targetPath = projectPath || cwd;
  return path.basename(targetPath) || 'unknown-project';
}

/**
 * 推断观察类型
 */
function inferObservationType(
  toolName: string,
  toolInput: Record<string, unknown>
): 'bugfix' | 'feature' | 'refactor' | 'change' | 'discovery' | 'decision' {
  const inputStr = JSON.stringify(toolInput).toLowerCase();

  // 根据工具和内容推断类型
  if (inputStr.includes('fix') || inputStr.includes('bug') || inputStr.includes('error')) {
    return 'bugfix';
  }
  if (inputStr.includes('add') || inputStr.includes('new') || inputStr.includes('feature')) {
    return 'feature';
  }
  if (inputStr.includes('refactor') || inputStr.includes('rename') || inputStr.includes('move')) {
    return 'refactor';
  }
  if (toolName === 'Read' || toolName === 'Glob' || toolName === 'Grep') {
    return 'discovery';
  }

  return 'change';
}

/**
 * 处理工具使用事件
 */
async function handleToolUse(
  input: ToolUseHookInput,
  state: SessionState,
  trackedTools: string[]
): Promise<SessionState> {
  const { tool_name, tool_input, tool_output, hook_type } = input;

  // 只处理 PostToolUse 事件
  if (hook_type !== 'PostToolUse') {
    return state;
  }

  // 检查是否是跟踪的工具
  if (!trackedTools.includes(tool_name)) {
    return state;
  }

  // 更新文件列表
  if (tool_name === 'Read' && tool_input.file_path) {
    const filePath = String(tool_input.file_path);
    if (!state.filesRead.includes(filePath)) {
      state.filesRead.push(filePath);
    }
  }

  if ((tool_name === 'Edit' || tool_name === 'Write') && tool_input.file_path) {
    const filePath = String(tool_input.file_path);
    if (!state.filesModified.includes(filePath)) {
      state.filesModified.push(filePath);
    }

    // 创建观察记录
    const observation: ObservationRecord = {
      id: state.observations.length + 1,
      timestamp: Date.now(),
      toolName: tool_name,
      type: inferObservationType(tool_name, tool_input),
      title: `${tool_name}: ${path.basename(filePath)}`,
      facts: [`使用 ${tool_name} 工具操作文件`],
      filesRead: [...state.filesRead],
      filesModified: [filePath]
    };

    state.observations.push(observation);
  }

  if (tool_name === 'Bash' && tool_input.command) {
    const command = String(tool_input.command);
    // 创建 Bash 命令观察记录
    const observation: ObservationRecord = {
      id: state.observations.length + 1,
      timestamp: Date.now(),
      toolName: tool_name,
      type: 'change',
      title: `执行命令`,
      subtitle: command.substring(0, 100),
      facts: [`执行 Bash 命令: ${command.substring(0, 200)}`],
      filesRead: [],
      filesModified: []
    };

    state.observations.push(observation);
  }

  state.promptCount++;
  return state;
}

/**
 * 使用 Claude API 生成会话摘要
 */
async function generateSummary(state: SessionState): Promise<string | null> {
  try {
    const apiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
    const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
    const model = process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL || 'claude-haiku-4-5-20251001';

    if (!apiKey) {
      await log('WARN', 'No API key found, skipping summary generation');
      return null;
    }

    // 构建摘要提示
    const observationsSummary = state.observations
      .map((obs) => `- ${obs.type}: ${obs.title}`)
      .join('\n');

    const prompt = `请为以下 Claude Code 会话生成一个简洁的中文摘要：

会话信息：
- 项目路径: ${state.projectPath}
- 观察记录数: ${state.observations.length}
- 读取文件数: ${state.filesRead.length}
- 修改文件数: ${state.filesModified.length}

观察记录：
${observationsSummary}

请生成一个包含以下内容的摘要（每项2-3句话）：
1. 调查内容：主要查看和分析了什么
2. 学到的知识：发现了什么重要信息或模式
3. 完成的工作：具体做了哪些修改或操作
4. 下一步计划：建议接下来做什么

请直接返回摘要内容，不要包含标题或其他格式。`;

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      await log('ERROR', 'API request failed', { status: response.status });
      return null;
    }

    const data = await response.json() as { content?: Array<{ text?: string }> };
    const summary = data.content?.[0]?.text;

    if (summary) {
      await log('INFO', 'Summary generated successfully');
      return summary;
    }

    return null;
  } catch (error) {
    await log('ERROR', 'Failed to generate summary', { error: String(error) });
    return null;
  }
}

/**
 * 处理会话停止事件 - 同步到 Obsidian
 */
async function handleStop(
  input: StopHookInput,
  state: SessionState,
  config: ReturnType<typeof mergeConfig>
): Promise<void> {
  await log('INFO', 'Session stopped, syncing to Obsidian', {
    sessionId: input.session_id,
    observationCount: state.observations.length
  });

  // 动态导入同步模块
  const { createObsidianSync } = await import('../src/sync.js');

  const sync = await createObsidianSync({
    vaultPath: config.vaultPath,
    baseFolder: config.baseFolder,
    syncObservations: config.syncObservations,
    syncSummaries: config.syncSummaries
  });

  const project = getProjectName(input.project_path, input.cwd);

  // 同步所有观察记录
  for (const obs of state.observations) {
    try {
      await sync.syncObservation(
        {
          type: obs.type,
          title: obs.title,
          subtitle: obs.subtitle || null,
          facts: obs.facts,
          narrative: null,
          concepts: [],
          files_read: obs.filesRead,
          files_modified: obs.filesModified
        },
        {
          id: obs.id,
          sessionId: state.sessionId,
          project,
          promptNumber: obs.id,
          createdAtEpoch: obs.timestamp
        }
      );
      await log('INFO', 'Observation synced', { id: obs.id, title: obs.title });
    } catch (error) {
      await log('ERROR', 'Failed to sync observation', { id: obs.id, error: String(error) });
    }
  }

  // 生成并同步摘要
  if (config.syncSummaries && state.observations.length > 0) {
    try {
      // 优先使用 Claude Code 提供的摘要，否则主动生成
      let summaryText: string | undefined = input.transcript_summary;

      if (!summaryText) {
        await log('INFO', 'No transcript summary provided, generating with Claude API');
        summaryText = await generateSummary(state) ?? undefined;
      }

      if (summaryText) {
        await sync.syncSummary(
          {
            request: `会话 ${state.sessionId.substring(0, 8)}`,
            investigated: `处理了 ${state.filesRead.length} 个文件`,
            learned: summaryText,
            completed: `修改了 ${state.filesModified.length} 个文件，执行了 ${state.observations.length} 个操作`,
            next_steps: '',
            notes: `停止原因: ${input.stop_reason}`
          },
          {
            id: parseInt(`${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`),
            sessionId: state.sessionId,
            project,
            promptNumber: state.promptCount,
            createdAtEpoch: Date.now()
          }
        );
        await log('INFO', 'Summary synced');
      } else {
        await log('WARN', 'No summary available to sync');
      }
    } catch (error) {
      await log('ERROR', 'Failed to sync summary', { error: String(error) });
    }
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  try {
    // 清理旧状态
    await cleanupOldStates();

    // 读取输入
    const inputStr = await readStdin();
    if (!inputStr.trim()) {
      await log('WARN', 'Empty input received');
      return;
    }

    const input: HookInput = JSON.parse(inputStr);
    await log('DEBUG', 'Received hook input', { hook_type: input.hook_type });

    // 加载配置
    const rawConfig = await loadConfig();
    if (!rawConfig) {
      await log('WARN', 'No config found, skipping');
      return;
    }

    const config = mergeConfig(rawConfig);
    await log('DEBUG', 'Config loaded', { vaultPath: config.vaultPath });

    // 获取或创建会话状态
    const sessionId = input.session_id;
    let state = await loadSessionState(sessionId);

    if (!state) {
      const projectPath = 'project_path' in input ? input.project_path : undefined;
      state = createSessionState(sessionId, projectPath || input.cwd);
      await log('INFO', 'Created new session state', { sessionId });
    }

    // 根据事件类型处理
    if (input.hook_type === 'PreToolUse' || input.hook_type === 'PostToolUse') {
      state = await handleToolUse(input as ToolUseHookInput, state, config.trackedTools);
      await saveSessionState(state);
    } else if (input.hook_type === 'Stop') {
      await handleStop(input as StopHookInput, state, config);
    }

    await log('DEBUG', 'Hook processing completed');
  } catch (error) {
    await log('ERROR', 'Hook handler error', { error: String(error) });
  }
}

// 运行主函数
main().catch(async (error) => {
  await log('ERROR', 'Unhandled error', { error: String(error) });
});
