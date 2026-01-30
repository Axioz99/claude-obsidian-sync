# Claude Obsidian Sync - 配置指南

本文档详细说明如何配置 Claude Obsidian Sync 以实现自动同步功能。

## 目录

1. [前置要求](#前置要求)
2. [快速安装](#快速安装)
3. [手动配置](#手动配置)
4. [配置说明](#配置说明)
5. [故障排查](#故障排查)

## 前置要求

- Node.js 和 npm 已安装
- Claude Code CLI 已安装并配置
- Obsidian 应用已安装
- 已创建 Obsidian vault

## 快速安装

使用自动安装脚本（推荐）：

```bash
cd claud-mem
npx ts-node scripts/install.ts
```

按照提示输入 Obsidian vault 路径，脚本会自动完成所有配置。

## 手动配置

### 1. 创建配置文件

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

**配置项说明**：
- `vaultPath`: Obsidian vault 的绝对路径（必填）
- `baseFolder`: 在 vault 中创建的基础文件夹名称（默认：ClaudeCode）
- `observationsFolder`: 观察记录文件夹名称（默认：观察，可自定义便于国际化）
- `summariesFolder`: 摘要文件夹名称（默认：摘要，可自定义便于国际化）
- `syncObservations`: 是否同步观察记录（默认：true）
- `syncSummaries`: 是否同步会话摘要（默认：true）
- `trackedTools`: 要跟踪的工具列表（默认：Edit, Write, Bash, Read）
- `logLevel`: 日志级别（debug, info, warn, error）

### 2. 配置 Claude Code Hooks

在 `~/.claude/settings.json` 中添加 hooks 配置：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-api-key",
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com"
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "npx ts-node --project /path/to/claud-mem/tsconfig.hooks.json /path/to/claud-mem/hooks/hook-handler.ts",
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
            "command": "npx ts-node --project /path/to/claud-mem/tsconfig.hooks.json /path/to/claud-mem/hooks/hook-handler.ts"
          }
        ]
      }
    ]
  }
}
```

**重要说明**：
- 将 `/path/to/claud-mem` 替换为实际的项目路径
- `--project` 参数指定 TypeScript 配置文件，确保正确的模块解析
- `async: true` 让 PostToolUse hook 异步执行，不阻塞 Claude Code
- `env` 中的 API 配置用于生成摘要（可选，如果没有则不会主动生成摘要）

### 3. 创建 Obsidian 文件夹结构

在 Obsidian vault 中创建以下文件夹：

```
{vault}/ClaudeCode/
├── 观察/
└── 摘要/
```

可以手动创建，或者让同步功能自动创建。

## 配置说明

### 工作原理

1. **PostToolUse Hook**：
   - 在每次工具调用后触发
   - 记录文件读取、修改、命令执行等操作
   - 异步执行，不影响 Claude Code 性能

2. **Stop Hook**：
   - 在会话结束时触发
   - 同步所有观察记录到 Obsidian
   - 生成并同步会话摘要

### 摘要生成

摘要生成有两种方式：

1. **被动模式**：使用 Claude Code 提供的 `transcript_summary`
2. **主动模式**：如果没有提供摘要，调用 Claude API 生成

主动生成摘要需要配置环境变量：
- `ANTHROPIC_AUTH_TOKEN`: API 密钥
- `ANTHROPIC_BASE_URL`: API 基础 URL（可选）
- `ANTHROPIC_DEFAULT_HAIKU_MODEL`: 使用的模型（默认：claude-haiku-4-5-20251001）

### 生成的笔记格式

**观察记录**：`ClaudeCode/观察/YYYY-MM/obs_{id}_{title}.md`

```markdown
---
id: 123
type: feature
project: my-project
session_id: abc123
prompt_number: 1
created_at: 2026-01-29T12:00:00.000Z
tags:
  - ClaudeCode/observation
  - ClaudeCode/type/feature
files_modified:
  - src/index.ts
---

# 🟣 添加新功能

**类型**: feature | **时间**: 2026/01/29 12:00 | **项目**: my-project

## 事实
- 使用 Write 工具操作文件

## 相关文件
### 修改
- `src/index.ts`
```

**会话摘要**：`ClaudeCode/摘要/YYYY-MM/sum_{id}_{request}.md`

```markdown
---
id: 456
project: my-project
session_id: abc123
created_at: 2026-01-29T12:00:00.000Z
tags:
  - ClaudeCode/summary
---

# 📋 会话 abc12345

**时间**: 2026/01/29 12:00 | **项目**: my-project

## 调查内容
[AI 生成的内容]

## 学到的知识
[AI 生成的内容]

## 完成的工作
修改了 3 个文件，执行了 5 个操作
```

## 故障排查

### 问题 1: Hook 没有触发

**症状**：会话结束后没有生成笔记

**解决方案**：
1. 检查 `~/.claude/settings.json` 中的 hooks 配置是否正确
2. 确认路径使用绝对路径，不是相对路径
3. 重启 Claude Code 让配置生效

### 问题 2: 模块导入错误

**症状**：`Cannot find module 'config.js'`

**解决方案**：
1. 确保使用 `--project` 参数指定 `tsconfig.hooks.json`
2. 检查 `tsconfig.hooks.json` 中的模块配置是否为 CommonJS
3. 确认所有导入语句没有 `.js` 扩展名

### 问题 3: 没有生成摘要

**症状**：只有观察记录，没有摘要

**解决方案**：
1. 检查 `obsidian-sync.json` 中 `syncSummaries` 是否为 `true`
2. 确认环境变量中有 `ANTHROPIC_AUTH_TOKEN`
3. 查看日志文件：`%TEMP%\claude-obsidian-sync\hook.log`

### 问题 4: API 调用失败

**症状**：日志显示 "API request failed"

**解决方案**：
1. 检查 API 密钥是否正确
2. 确认 `ANTHROPIC_BASE_URL` 是否可访问
3. 检查网络连接

### 查看日志

日志文件位置：
- **Windows**: `%TEMP%\claude-obsidian-sync\hook.log`
- **macOS/Linux**: `/tmp/claude-obsidian-sync/hook.log`

查看日志：
```bash
# Windows (PowerShell)
Get-Content $env:TEMP\claude-obsidian-sync\hook.log -Tail 50

# macOS/Linux
tail -f /tmp/claude-obsidian-sync/hook.log
```

## 测试配置

配置完成后，测试是否正常工作：

1. **重启 Claude Code**
2. **执行一些操作**：
   ```bash
   # 编辑文件
   echo "test" > test.txt

   # 运行命令
   ls -la
   ```
3. **结束会话**（输入 `/exit`）
4. **检查 Obsidian**：
   - 打开 Obsidian
   - 查看 `ClaudeCode/观察/2026-01/` 文件夹
   - 查看 `ClaudeCode/摘要/2026-01/` 文件夹
5. **查看日志**：
   - 检查是否有错误信息
   - 确认同步成功

## 高级配置

### 自定义跟踪工具

修改 `obsidian-sync.json` 中的 `trackedTools`：

```json
{
  "trackedTools": ["Edit", "Write", "Bash", "Read", "Grep", "Glob"]
}
```

### 调整日志级别

```json
{
  "logLevel": "debug"
}
```

日志级别：
- `debug`: 详细调试信息
- `info`: 一般信息（默认）
- `warn`: 警告信息
- `error`: 仅错误信息

### 禁用特定同步

```json
{
  "syncObservations": false,  // 不同步观察记录
  "syncSummaries": true        // 只同步摘要
}
```

## 更新配置

修改配置后需要重启 Claude Code 才能生效。

## 卸载

1. 删除配置文件：
   ```bash
   rm ~/.claude/obsidian-sync.json
   ```

2. 从 `~/.claude/settings.json` 中移除 hooks 配置

3. 删除 Obsidian 中的 `ClaudeCode` 文件夹（可选）

## 支持

如有问题，请查看：
- 项目 README: [README.md](./README.md)
- 日志文件: `%TEMP%\claude-obsidian-sync\hook.log`
- GitHub Issues: [提交问题](https://github.com/your-repo/issues)
