# Claude Obsidian Sync

将 Claude Code 对话上下文同步到 Obsidian 的独立工具。

## 📚 文档

- [配置指南](./CONFIGURATION.md) - 详细的配置说明和故障排查
- [变更日志](./CHANGELOG.md) - 版本历史和更新记录
- [API 文档](#api-参考) - 编程接口说明

## 功能特性

- 将 Claude Code 的观察记录和会话摘要同步到 Obsidian vault
- 自动生成 YAML frontmatter 元数据
- 自动添加 Obsidian 标签（类型、概念、项目）
- 按月份组织笔记文件夹
- 支持批量同步
- **支持 Claude Code Hooks 自动同步**
- 完全独立，可集成到任何项目

## 快速开始（自动同步）

### 方法一：使用安装脚本

```bash
cd claud-mem
npx ts-node scripts/install.ts
```

按照提示输入 Obsidian vault 路径即可完成配置。

### 方法二：手动配置

#### 1. 创建配置文件

在 `~/.claude/obsidian-sync.json` 创建配置文件：

```json
{
  "vaultPath": "D:/你的Obsidian库路径",
  "baseFolder": "ClaudeCode",
  "syncObservations": true,
  "syncSummaries": true,
  "trackedTools": ["Edit", "Write", "Bash", "Read"],
  "logLevel": "info"
}
```

#### 2. 配置 Claude Code Hooks

在 `~/.claude/settings.json` 中添加 hooks 配置：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "npx ts-node --project D:/Claudecodepj/claud-mem/tsconfig.hooks.json D:/Claudecodepj/claud-mem/hooks/hook-handler.ts",
            "async": true
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx ts-node --project D:/Claudecodepj/claud-mem/tsconfig.hooks.json D:/Claudecodepj/claud-mem/hooks/hook-handler.ts"
          }
        ]
      }
    ]
  }
}
```

**注意**：
- 将路径替换为你实际的 claud-mem 项目路径
- `--project` 参数指定 TypeScript 配置文件，确保正确的模块解析
- `async: true` 让 PostToolUse hook 异步执行，不阻塞 Claude Code

#### 3. 创建 Obsidian 文件夹结构

在你的 Obsidian vault 中创建以下文件夹：

```
{vault}/ClaudeCode/
├── 观察/
└── 摘要/
```

### 配置完成后

重启 Claude Code，之后的对话将自动同步到 Obsidian：
- **工具调用**（Edit、Write、Bash）会被记录为观察
- **会话结束**时会自动生成摘要
  - 优先使用 Claude Code 提供的摘要
  - 如果没有，会调用 Claude API 主动生成摘要
  - 使用 `ANTHROPIC_AUTH_TOKEN` 和 `ANTHROPIC_BASE_URL` 环境变量

### 查看日志

日志文件位置：
- Windows: `%TEMP%\claude-obsidian-sync\hook.log`
- macOS/Linux: `/tmp/claude-obsidian-sync/hook.log`

## 安装

```bash
npm install claude-obsidian-sync
```

## 使用方法

### 基本用法

```typescript
import { createObsidianSync } from 'claude-obsidian-sync';

// 创建同步实例（异步函数，会验证路径存在性）
const sync = await createObsidianSync({
  vaultPath: 'D:/MyObsidianVault',  // Obsidian vault 路径
  baseFolder: 'ClaudeCode'           // 基础文件夹名称
});

// 同步观察记录
await sync.syncObservation(
  {
    type: 'bugfix',
    title: '修复登录验证问题',
    subtitle: '用户无法使用特殊字符密码登录',
    facts: ['密码验证函数未正确处理特殊字符', '添加了转义处理'],
    narrative: '发现登录模块的密码验证存在问题...',
    concepts: ['problem-solution', 'gotcha'],
    files_read: ['src/auth/login.ts'],
    files_modified: ['src/auth/validator.ts']
  },
  {
    id: 123,
    sessionId: 'session-abc',
    project: 'my-project',
    promptNumber: 1,
    createdAtEpoch: Date.now()
  }
);

// 同步摘要
await sync.syncSummary(
  {
    request: '实现用户认证功能',
    investigated: '研究了 JWT 和 Session 两种方案',
    learned: 'JWT 更适合无状态 API',
    completed: '完成了登录、注册、密码重置功能',
    next_steps: '添加 OAuth 第三方登录',
    notes: '需要注意 token 过期处理'
  },
  {
    id: 456,
    sessionId: 'session-abc',
    project: 'my-project',
    promptNumber: 5,
    createdAtEpoch: Date.now()
  }
);
```

### 批量同步

```typescript
// 批量同步观察记录
const results = await sync.syncObservations([
  { observation: obs1, metadata: meta1 },
  { observation: obs2, metadata: meta2 }
]);

// 批量同步摘要
const summaryResults = await sync.syncSummaries([
  { summary: sum1, metadata: meta1 },
  { summary: sum2, metadata: meta2 }
]);
```

### 自定义日志

```typescript
const sync = await createObsidianSync(
  { vaultPath: 'D:/MyVault' },
  {
    info: (cat, msg, data) => myLogger.info(`[${cat}] ${msg}`, data),
    warn: (cat, msg, data) => myLogger.warn(`[${cat}] ${msg}`, data),
    error: (cat, msg, data, err) => myLogger.error(`[${cat}] ${msg}`, data, err),
    debug: (cat, msg, data) => myLogger.debug(`[${cat}] ${msg}`, data)
  }
);
```

## 生成的笔记结构

```
{vault}/ClaudeCode/
├── 观察/
│   └── 2026-01/
│       ├── obs_123_修复登录验证问题.md
│       └── obs_124_添加用户头像功能.md
└── 摘要/
    └── 2026-01/
        └── sum_456_实现用户认证功能.md
```

## 笔记格式

### 观察记录

```markdown
---
id: 123
type: bugfix
project: my-project
session_id: session-abc
prompt_number: 1
created_at: 2026-01-28T10:30:00.000Z
tags:
  - ClaudeCode/observation
  - ClaudeCode/type/bugfix
  - ClaudeCode/project/my-project
  - ClaudeCode/concept/problem-solution
files_read:
  - src/auth/login.ts
files_modified:
  - src/auth/validator.ts
---

# 🔴 修复登录验证问题

> 用户无法使用特殊字符密码登录

**类型**: bugfix | **时间**: 2026/01/28 10:30 | **项目**: my-project

## 事实
- 密码验证函数未正确处理特殊字符
- 添加了转义处理

## 叙述
发现登录模块的密码验证存在问题...

## 概念标签
#ClaudeCode/concept/problem-solution #ClaudeCode/concept/gotcha

## 相关文件
### 读取
- `src/auth/login.ts`

### 修改
- `src/auth/validator.ts`
```

### 标签映射

| 观察类型 | Emoji | 标签 |
|---------|-------|------|
| bugfix | 🔴 | `#ClaudeCode/type/bugfix` |
| feature | 🟣 | `#ClaudeCode/type/feature` |
| refactor | 🔄 | `#ClaudeCode/type/refactor` |
| change | ✅ | `#ClaudeCode/type/change` |
| discovery | 🔵 | `#ClaudeCode/type/discovery` |
| decision | ⚖️ | `#ClaudeCode/type/decision` |

## 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | boolean | `true` | 是否启用同步 |
| `vaultPath` | string | (必填) | Obsidian vault 绝对路径 |
| `baseFolder` | string | `'ClaudeCode'` | 基础文件夹名称 |
| `observationsFolder` | string | `'观察'` | 观察记录文件夹名称（可自定义） |
| `summariesFolder` | string | `'摘要'` | 摘要文件夹名称（可自定义） |
| `syncObservations` | boolean | `true` | 是否同步观察记录 |
| `syncSummaries` | boolean | `true` | 是否同步摘要 |

## API 参考

### `createObsidianSync(config, logger?): Promise<ObsidianSync>`

创建 ObsidianSync 实例的异步工厂函数。会验证 vaultPath 是否存在。

### `ObsidianSync`

#### 方法

- `isEnabled(): boolean` - 检查同步是否启用
- `getConfig(): ObsidianSyncConfig` - 获取配置
- `syncObservation(observation, metadata): Promise<SyncResult>` - 同步单个观察
- `syncSummary(summary, metadata): Promise<SyncResult>` - 同步单个摘要
- `syncObservations(items): Promise<SyncResult[]>` - 批量同步观察
- `syncSummaries(items): Promise<SyncResult[]>` - 批量同步摘要

### 格式化工具

- `formatObservationNote(obs, metadata): string` - 格式化观察为 Markdown
- `formatSummaryNote(summary, metadata): string` - 格式化摘要为 Markdown
- `sanitizeFileName(name): string` - 清理文件名
- `formatYearMonth(epoch): string` - 格式化为 YYYY-MM
- `generateFrontmatter(data): string` - 生成 YAML frontmatter

## 许可证

MIT
