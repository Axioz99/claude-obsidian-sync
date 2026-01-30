# 变更日志

本文档记录 Claude Obsidian Sync 项目的所有重要变更。

## [0.0.2] - 2026-01-30

### 修复

#### ES Module 兼容性问题
- 修复 `exports is not defined in ES module scope` 错误
- 更新 `tsconfig.hooks.json` 使用 ESNext 模块系统
- 添加 `.js` 扩展名到所有 ES 模块导入语句

#### Claude Code Hook 字段名修复
- 修复 Claude Code 实际使用 `hook_event_name` 而非 `hook_type` 的问题
- 修复 Claude Code 实际使用 `tool_response` 而非 `tool_output` 的问题
- 更新 `hooks/types.ts` 类型定义匹配 Claude Code 实际输入格式

### 改进

#### 调试增强
- 添加原始输入日志记录，便于排查问题
- 记录解析后的 hook 输入详情

#### 文档更新
- 更新 README 使用编译后的 JS 文件配置 hooks
- 简化 hooks 配置，推荐使用 `node` 直接运行编译后的文件

## [未发布] - 2026-01-29

### 新增功能

#### 配置增强
- 添加 `observationsFolder` 和 `summariesFolder` 可配置选项
- 支持自定义观察和摘要文件夹名称，便于国际化

#### 主动生成摘要
- 添加 `generateSummary()` 函数，使用 Claude API 自动生成会话摘要
- 优先使用 Claude Code 提供的 `transcript_summary`
- 如果没有提供摘要，自动调用 API 生成
- 使用 Haiku 模型以降低成本
- 生成包含调查内容、学到的知识、完成的工作、下一步计划的结构化摘要

#### Claude Code Hooks 集成
- 实现完整的 hooks 支持
- `PostToolUse` hook：记录工具调用（Edit、Write、Bash、Read）
- `Stop` hook：会话结束时同步所有记录
- 异步执行，不阻塞 Claude Code 性能

#### 会话状态管理
- 实现会话状态持久化
- 跟踪文件读取和修改
- 记录所有观察
- 自动清理过期状态（24小时）

#### 安装脚本
- 创建 `scripts/install.ts` 自动安装脚本
- 交互式配置向导
- 自动创建配置文件
- 自动配置 Claude Code hooks
- 自动创建 Obsidian 文件夹结构

### 修复

#### TypeScript 模块导入问题
- 修复 `Cannot find module 'config.js'` 错误
- 移除所有导入语句中的 `.js` 扩展名
- 配置 `tsconfig.hooks.json` 使用 CommonJS 模块系统
- 更新 hook 命令添加 `--project` 参数

### 改进

#### 性能优化
- 批量同步使用 `Promise.allSettled` 并行执行
- 提升多文件同步性能

#### 路径验证
- `createObsidianSync` 工厂函数现在验证 vaultPath 存在性
- 函数签名变更为异步 (`async`)，返回 `Promise<ObsidianSync>`

#### 错误处理增强
- 所有 catch 块现在记录错误信息到 stderr
- 区分 ENOENT（文件不存在）和其他错误类型
- 改进摘要 ID 生成，使用时间戳+随机数避免冲突

#### 配置系统
- 支持项目级和用户级配置
- 配置文件：`~/.claude/obsidian-sync.json`
- 支持自定义跟踪工具列表
- 支持日志级别配置

#### 日志系统
- 静默日志，不干扰 Claude Code 输出
- 日志文件：`%TEMP%\claude-obsidian-sync\hook.log`
- 支持多个日志级别（debug, info, warn, error）
- 详细的错误信息和调试信息

#### 文档
- 创建详细的配置指南（CONFIGURATION.md）
- 更新 README 添加 hooks 配置说明
- 添加故障排查指南
- 添加测试步骤

### 技术细节

#### 依赖
- Node.js fs/promises API
- TypeScript 5.x
- ts-node for runtime execution
- Claude API for summary generation

#### 文件结构
```
claud-mem/
├── src/                    # 核心库代码
│   ├── index.ts
│   ├── types.ts
│   ├── sync.ts
│   └── formatter.ts
├── hooks/                  # Claude Code hooks
│   ├── hook-handler.ts    # Hook 入口脚本
│   ├── config.ts          # 配置加载
│   ├── state.ts           # 会话状态管理
│   └── types.ts           # Hook 类型定义
├── scripts/               # 工具脚本
│   └── install.ts         # 安装向导
├── tests/                 # 测试文件
├── examples/              # 使用示例
└── docs/                  # 文档
```

#### 配置文件
- `tsconfig.json`: 主 TypeScript 配置
- `tsconfig.hooks.json`: Hooks 专用配置（CommonJS）
- `~/.claude/obsidian-sync.json`: 用户配置
- `~/.claude/settings.json`: Claude Code 配置

### 已知问题

1. **首次运行**：需要重启 Claude Code 才能加载 hooks 配置
2. **模块系统**：必须使用 CommonJS 模块系统，ESM 暂不支持
3. **API 限制**：摘要生成依赖 Claude API，需要有效的 API 密钥

### 计划功能

- [ ] 支持自定义摘要模板
- [ ] 支持多个 Obsidian vault
- [ ] 添加观察记录过滤规则
- [ ] 支持自定义标签系统
- [ ] 添加 Web UI 配置界面
- [ ] 支持导出为其他格式（JSON、CSV）

## [0.1.0] - 初始版本

### 核心功能

- 基础同步功能
- 观察记录格式化
- 摘要格式化
- Obsidian Markdown 生成
- YAML frontmatter 支持
- 按月份组织文件

---

## 版本说明

版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)：

- **主版本号**：不兼容的 API 修改
- **次版本号**：向下兼容的功能性新增
- **修订号**：向下兼容的问题修正

## 贡献

欢迎提交 Issue 和 Pull Request！
