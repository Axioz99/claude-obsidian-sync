# Claude Code Hooks 集成

通过 Claude Code 的 hooks 系统自动将会话上下文同步到 Obsidian。

## 工作原理

1. **PostToolUse Hook**: 在每次工具调用后记录操作（编辑、写入、命令执行等）
2. **Stop Hook**: 在会话结束时生成摘要并同步所有数据到 Obsidian

## 快速安装

### 方式一：使用安装向导（推荐）

```bash
cd claude-obsidian-sync
npm install
npm run build:all
npm run install-hooks
```

安装向导会引导你完成配置，自动设置 Claude Code hooks。

### 方式二：手动安装

#### 1. 编译 hooks 脚本

```bash
cd claude-obsidian-sync
npm install
npm run build:hooks
```

#### 2. 创建配置文件

在 `~/.claude/` 目录下创建 `obsidian-sync.json`:

```json
{
  "vaultPath": "D:/MyObsidianVault",
  "baseFolder": "ClaudeCode",
  "syncObservations": true,
  "syncSummaries": true,
  "trackedTools": ["Edit", "Write", "Bash"],
  "logLevel": "info"
}
```

#### 3. 配置 Claude Code hooks

在 `~/.claude/settings.json` 中添加 hooks 配置:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|Bash",
        "command": "node /path/to/claude-obsidian-sync/dist/hooks/sync-hook.js"
      }
    ],
    "Stop": [
      {
        "command": "node /path/to/claude-obsidian-sync/dist/hooks/sync-hook.js"
      }
    ]
  }
}
```

**注意**: 将 `/path/to/claude-obsidian-sync` 替换为实际的安装路径。

## 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `vaultPath` | string | (必填) | Obsidian vault 绝对路径 |
| `baseFolder` | string | `'ClaudeCode'` | 基础文件夹名称 |
| `syncObservations` | boolean | `true` | 是否同步观察记录 |
| `syncSummaries` | boolean | `true` | 是否同步摘要 |
| `trackedTools` | string[] | `['Edit', 'Write', 'Bash']` | 要跟踪的工具列表 |
| `logLevel` | string | `'info'` | 日志级别: debug, info, warn, error |

## 配置文件位置

配置文件按以下顺序查找（优先使用第一个找到的）:

1. `{项目目录}/.claude/obsidian-sync.json` - 项目级配置
2. `~/.claude/obsidian-sync.json` - 用户级配置

## 数据流

```
Claude Code 会话
    │
    ├─→ PostToolUse Hook (Edit/Write/Bash)
    │       │
    │       └─→ 记录操作到临时状态文件
    │
    └─→ Stop Hook (会话结束)
            │
            ├─→ 读取临时状态
            ├─→ 生成观察记录和摘要
            ├─→ 同步到 Obsidian vault
            └─→ 清理临时状态
```

## 故障排除

### 日志查看

设置 `logLevel: "debug"` 可以查看详细日志。日志输出到 stderr。

### 常见问题

1. **没有同步任何内容**
   - 检查配置文件路径是否正确
   - 确认 `vaultPath` 指向有效的 Obsidian vault
   - 检查 hooks 脚本路径是否正确

2. **权限错误**
   - 确保对 Obsidian vault 目录有写入权限
   - 确保临时目录可写

3. **Hook 未触发**
   - 检查 `~/.claude/settings.json` 中的 hooks 配置
   - 确认 matcher 正则表达式正确

## 文件结构

```
hooks/
├── types.ts              # 类型定义
├── config.ts             # 配置加载
├── state.ts              # 会话状态管理
├── install.ts            # 安装向导脚本
├── sync-hook.ts          # 主 hook 脚本
├── obsidian-sync.example.json  # 配置示例
└── README.md             # 本文档
```
