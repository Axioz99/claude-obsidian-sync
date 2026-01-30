/**
 * 基本使用示例
 *
 * 演示如何使用 claude-obsidian-sync 将对话上下文同步到 Obsidian
 */

import { createObsidianSync } from '../src/index.js';

async function main() {
  // 1. 创建同步实例
  const sync = createObsidianSync({
    vaultPath: 'D:/MyObsidianVault',  // 替换为你的 Obsidian vault 路径
    baseFolder: 'ClaudeCode'
  });

  // 2. 同步一个观察记录
  const obsResult = await sync.syncObservation(
    {
      type: 'bugfix',
      title: '修复用户登录验证问题',
      subtitle: '特殊字符密码无法正常验证',
      facts: [
        '密码验证函数未正确处理特殊字符',
        '添加了 encodeURIComponent 转义处理',
        '更新了相关单元测试'
      ],
      narrative: `在用户反馈无法使用包含特殊字符（如 @#$%）的密码登录后，
我们发现 validatePassword 函数在处理这些字符时存在问题。
通过添加适当的转义处理，问题已解决。`,
      concepts: ['problem-solution', 'gotcha'],
      files_read: ['src/auth/login.ts', 'src/auth/types.ts'],
      files_modified: ['src/auth/validator.ts', 'tests/auth.test.ts']
    },
    {
      id: 12345,
      sessionId: 'session-abc-123',
      project: 'my-web-app',
      promptNumber: 3,
      createdAtEpoch: Date.now()
    }
  );

  console.log('观察同步结果:', obsResult);

  // 3. 同步一个会话摘要
  const sumResult = await sync.syncSummary(
    {
      request: '实现用户认证系统',
      investigated: `研究了多种认证方案：
- JWT (JSON Web Tokens)
- Session-based authentication
- OAuth 2.0`,
      learned: `JWT 更适合无状态 API 架构，因为：
- 不需要服务器存储会话状态
- 支持跨域认证
- 易于扩展到微服务架构`,
      completed: `完成了以下功能：
- 用户注册和登录
- JWT token 生成和验证
- 密码重置流程
- 登录状态持久化`,
      next_steps: `下一步计划：
- 添加 OAuth 第三方登录（Google, GitHub）
- 实现双因素认证
- 添加登录日志和异常检测`,
      notes: '需要注意 token 过期时间的设置，建议 access token 15分钟，refresh token 7天'
    },
    {
      id: 67890,
      sessionId: 'session-abc-123',
      project: 'my-web-app',
      promptNumber: 10,
      createdAtEpoch: Date.now()
    }
  );

  console.log('摘要同步结果:', sumResult);

  // 4. 批量同步示例
  const batchResults = await sync.syncObservations([
    {
      observation: {
        type: 'feature',
        title: '添加用户头像上传功能',
        subtitle: '支持 JPG/PNG 格式，最大 5MB',
        facts: ['使用 multer 处理文件上传', '图片存储到 S3'],
        narrative: null,
        concepts: ['how-it-works'],
        files_read: [],
        files_modified: ['src/routes/user.ts', 'src/services/upload.ts']
      },
      metadata: {
        id: 12346,
        sessionId: 'session-abc-123',
        project: 'my-web-app',
        promptNumber: 4,
        createdAtEpoch: Date.now()
      }
    },
    {
      observation: {
        type: 'discovery',
        title: '发现数据库连接池配置问题',
        subtitle: '默认连接数过低导致高并发时超时',
        facts: ['默认连接数为 10', '建议生产环境设置为 50-100'],
        narrative: '在压力测试中发现数据库连接超时问题...',
        concepts: ['gotcha', 'pattern'],
        files_read: ['config/database.ts'],
        files_modified: []
      },
      metadata: {
        id: 12347,
        sessionId: 'session-abc-123',
        project: 'my-web-app',
        promptNumber: 5,
        createdAtEpoch: Date.now()
      }
    }
  ]);

  console.log('批量同步结果:', batchResults);
}

main().catch(console.error);
