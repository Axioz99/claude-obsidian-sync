import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { HookConfig } from './types';

const CONFIG_FILENAME = 'obsidian-sync.json';

/**
 * 获取配置文件路径
 */
function getConfigPaths(): string[] {
  const home = os.homedir();
  return [
    // 项目级配置
    path.join(process.cwd(), '.claude', CONFIG_FILENAME),
    // 用户级配置
    path.join(home, '.claude', CONFIG_FILENAME),
  ];
}

/**
 * 加载配置
 */
export async function loadConfig(): Promise<HookConfig | null> {
  const configPaths = getConfigPaths();

  for (const configPath of configPaths) {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as HookConfig;
      return config;
    } catch (error) {
      // 配置文件不存在或解析失败，记录后继续尝试下一个
      const isNotFound = error instanceof Error &&
        (error as NodeJS.ErrnoException).code === 'ENOENT';
      if (!isNotFound) {
        console.error(`[obsidian-sync] 配置加载失败 ${configPath}:`, error);
      }
    }
  }

  return null;
}

/**
 * 默认配置
 */
export const defaultConfig: Partial<HookConfig> = {
  baseFolder: 'ClaudeCode',
  syncObservations: true,
  syncSummaries: true,
  trackedTools: ['Edit', 'Write', 'Bash'],
  logLevel: 'info',
};

/**
 * 合并配置
 */
export function mergeConfig(config: HookConfig): Required<HookConfig> {
  return {
    vaultPath: config.vaultPath,
    baseFolder: config.baseFolder ?? defaultConfig.baseFolder!,
    syncObservations: config.syncObservations ?? defaultConfig.syncObservations!,
    syncSummaries: config.syncSummaries ?? defaultConfig.syncSummaries!,
    trackedTools: config.trackedTools ?? defaultConfig.trackedTools!,
    logLevel: config.logLevel ?? defaultConfig.logLevel!,
  };
}
