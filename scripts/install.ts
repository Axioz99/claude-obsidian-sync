#!/usr/bin/env node
/**
 * Claude Obsidian Sync - 安装脚本
 *
 * 自动配置 Claude Code hooks 以启用 Obsidian 同步
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as readline from 'node:readline';

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');
const CONFIG_FILE = path.join(CLAUDE_DIR, 'obsidian-sync.json');

interface HookCommand {
  type: 'command';
  command: string;
  async?: boolean;
}

interface HookEntry {
  matcher?: string;
  hooks: HookCommand[];
}

interface ClaudeSettings {
  hooks?: {
    PostToolUse?: HookEntry[];
    Stop?: HookEntry[];
  };
  [key: string]: unknown;
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log('='.repeat(50));
  console.log('Claude Obsidian Sync - 安装向导');
  console.log('='.repeat(50));
  console.log();

  // 1. 获取 Obsidian vault 路径
  let vaultPath = await prompt('请输入 Obsidian vault 路径: ');
  if (!vaultPath) {
    console.log('错误: vault 路径不能为空');
    process.exit(1);
  }

  // 标准化路径
  vaultPath = vaultPath.replace(/\\/g, '/');

  // 检查路径是否存在
  if (!(await fileExists(vaultPath))) {
    console.log(`警告: 路径 "${vaultPath}" 不存在，将在首次同步时创建`);
  }

  // 2. 确保 .claude 目录存在
  await fs.mkdir(CLAUDE_DIR, { recursive: true });

  // 3. 创建配置文件
  const config = {
    vaultPath,
    baseFolder: 'ClaudeCode',
    syncObservations: true,
    syncSummaries: true,
    trackedTools: ['Edit', 'Write', 'Bash', 'Read'],
    logLevel: 'info'
  };

  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log(`\n✓ 配置文件已创建: ${CONFIG_FILE}`);

  // 4. 获取 hook 脚本路径
  const hookScriptPath = path.resolve(__dirname, '../hooks/hook-handler.ts').replace(/\\/g, '/');
  const tsconfigPath = path.resolve(__dirname, '../tsconfig.hooks.json').replace(/\\/g, '/');

  // 5. 更新 Claude settings.json
  let settings: ClaudeSettings = {};
  if (await fileExists(SETTINGS_FILE)) {
    const content = await fs.readFile(SETTINGS_FILE, 'utf-8');
    settings = JSON.parse(content);
  }

  // 配置 hooks
  settings.hooks = settings.hooks || {};

  // PostToolUse hook
  const hookCommand = `npx ts-node --project "${tsconfigPath}" "${hookScriptPath}"`;
  settings.hooks.PostToolUse = settings.hooks.PostToolUse || [];

  // 检查是否已存在
  const existingPostHook = settings.hooks.PostToolUse.find(
    (h) => h.hooks.some((cmd) => cmd.command.includes('hook-handler'))
  );

  if (!existingPostHook) {
    settings.hooks.PostToolUse.push({
      matcher: '.*',
      hooks: [{ type: 'command', command: hookCommand, async: true }]
    });
  }

  // Stop hook
  settings.hooks.Stop = settings.hooks.Stop || [];
  const existingStopHook = settings.hooks.Stop.find(
    (h) => h.hooks.some((cmd) => cmd.command.includes('hook-handler'))
  );

  if (!existingStopHook) {
    settings.hooks.Stop.push({
      hooks: [{ type: 'command', command: hookCommand }]
    });
  }

  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  console.log(`✓ Claude Code hooks 已配置: ${SETTINGS_FILE}`);

  // 6. 创建 Obsidian 文件夹结构
  const baseFolder = path.join(vaultPath, 'ClaudeCode');
  const observationsFolder = path.join(baseFolder, '观察');
  const summariesFolder = path.join(baseFolder, '摘要');

  try {
    await fs.mkdir(observationsFolder, { recursive: true });
    await fs.mkdir(summariesFolder, { recursive: true });
    console.log(`✓ Obsidian 文件夹结构已创建`);
  } catch (error) {
    console.log(`警告: 无法创建文件夹结构，将在首次同步时自动创建`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('安装完成！');
  console.log('='.repeat(50));
  console.log('\n下次使用 Claude Code 时，对话将自动同步到 Obsidian。');
  console.log(`\n日志文件位置: ${path.join(os.tmpdir(), 'claude-obsidian-sync', 'hook.log')}`);
}

main().catch((error) => {
  console.error('安装失败:', error);
  process.exit(1);
});
