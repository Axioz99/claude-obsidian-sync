import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

// 会话状态存储路径
const STATE_DIR = path.join(os.tmpdir(), 'claude-obsidian-sync');

export interface SessionState {
  sessionId: string;
  projectPath: string;
  startTime: number;
  observations: ObservationRecord[];
  filesRead: string[];
  filesModified: string[];
  promptCount: number;
}

export interface ObservationRecord {
  id: number;
  timestamp: number;
  toolName: string;
  type: 'bugfix' | 'feature' | 'refactor' | 'change' | 'discovery' | 'decision';
  title: string;
  subtitle?: string;
  facts: string[];
  filesRead: string[];
  filesModified: string[];
}

/**
 * 获取会话状态文件路径
 */
function getStatePath(sessionId: string): string {
  return path.join(STATE_DIR, `${sessionId}.json`);
}

/**
 * 确保状态目录存在
 */
async function ensureStateDir(): Promise<void> {
  await fs.mkdir(STATE_DIR, { recursive: true });
}

/**
 * 加载会话状态
 */
export async function loadSessionState(sessionId: string): Promise<SessionState | null> {
  try {
    const statePath = getStatePath(sessionId);
    const content = await fs.readFile(statePath, 'utf-8');
    return JSON.parse(content) as SessionState;
  } catch {
    return null;
  }
}

/**
 * 保存会话状态
 */
export async function saveSessionState(state: SessionState): Promise<void> {
  await ensureStateDir();
  const statePath = getStatePath(state.sessionId);
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
}

/**
 * 创建新会话状态
 */
export function createSessionState(sessionId: string, projectPath: string): SessionState {
  return {
    sessionId,
    projectPath,
    startTime: Date.now(),
    observations: [],
    filesRead: [],
    filesModified: [],
    promptCount: 0,
  };
}

/**
 * 清理会话状态
 */
export async function clearSessionState(sessionId: string): Promise<void> {
  try {
    const statePath = getStatePath(sessionId);
    await fs.unlink(statePath);
  } catch {
    // 忽略错误
  }
}

/**
 * 清理过期的会话状态（超过24小时）
 */
export async function cleanupOldStates(): Promise<void> {
  try {
    await ensureStateDir();
    const files = await fs.readdir(STATE_DIR);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(STATE_DIR, file);
      const stat = await fs.stat(filePath);
      if (now - stat.mtimeMs > maxAge) {
        await fs.unlink(filePath);
      }
    }
  } catch {
    // 忽略错误
  }
}
