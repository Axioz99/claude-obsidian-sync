#!/usr/bin/env node
/**
 * Claude Obsidian Sync - 安装脚本
 *
 * 帮助用户配置 Claude Code hooks
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as readline from 'node:readline';

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');
const SYNC_CONFIG_FILE = path.join(CLAUDE_DIR, 'obsidian-sync.json');

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readJsonFile(filePath: string): Promise<Record<string, unknown>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function main(): Promise<void> {
  console.log('=== Claude Obsidian Sync 安装向导 ===\n');

  // 获取当前脚本所在目录
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  // Windows 路径修复
  const hookScriptPath = path.resolve(
    scriptDir.startsWith('/') && process.platform === 'win32'
      ? scriptDir.slice(1)
      : scriptDir,
    'sync-hook.js'
  );

  console.log(`Hook 脚本路径: ${hookScriptPath}\n`);

  // 1. 获取 Obsidian vault 路径
  const vaultPath = await prompt('请输入 Obsidian vault 路径: ');
  if (!vaultPath) {
    console.error('错误: vault 路径不能为空');
    process.exit(1);
  }

  // 验证路径存在
  try {
    await fs.access(vaultPath);
  } catch {
    console.error(`错误: 路径不存在: ${vaultPath}`);
    process.exit(1);
  }

  // 2. 创建同步配置
  console.log('\n创建同步配置...');
  await ensureDir(CLAUDE_DIR);

  const syncConfig = {
    vaultPath,
    baseFolder: 'ClaudeCode',
    syncObservations: true,
    syncSummaries: true,
    trackedTools: ['Edit', 'Write', 'Bash'],
    logLevel: 'info',
  };

  await writeJsonFile(SYNC_CONFIG_FILE, syncConfig);
  console.log(`已创建: ${SYNC_CONFIG_FILE}`);

  // 3. 更新 Claude Code settings
  console.log('\n更新 Claude Code 设置...');
  const settings = await readJsonFile(SETTINGS_FILE);

  // 确保 hooks 对象存在
  if (!settings.hooks) {
    settings.hooks = {};
  }

  const hooks = settings.hooks as Record<string, unknown[]>;

  // 添加 PostToolUse hook
  const postToolUseHook = {
    matcher: 'Edit|Write|Bash',
    command: `node "${hookScriptPath}"`,
  };

  if (!hooks.PostToolUse) {
    hooks.PostToolUse = [];
  }

  // 检查是否已存在
  const existingPostHook = (hooks.PostToolUse as Array<{ command?: string }>).find(
    (h) => h.command?.includes('sync-hook')
  );
  if (!existingPostHook) {
    (hooks.PostToolUse as unknown[]).push(postToolUseHook);
  }

  // 添加 Stop hook
  const stopHook = {
    command: `node "${hookScriptPath}"`,
  };

  if (!hooks.Stop) {
    hooks.Stop = [];
  }

  const existingStopHook = (hooks.Stop as Array<{ command?: string }>).find(
    (h) => h.command?.includes('sync-hook')
  );
  if (!existingStopHook) {
    (hooks.Stop as unknown[]).push(stopHook);
  }

  await writeJsonFile(SETTINGS_FILE, settings);
  console.log(`已更新: ${SETTINGS_FILE}`);

  console.log('\n=== 安装完成 ===');
  console.log('\n配置摘要:');
  console.log(`  Obsidian Vault: ${vaultPath}`);
  console.log(`  基础文件夹: ClaudeCode`);
  console.log(`  跟踪工具: Edit, Write, Bash`);
  console.log('\n现在 Claude Code 会自动将会话同步到 Obsidian!');
}

main().catch((err) => {
  console.error('安装失败:', err);
  process.exit(1);
});
