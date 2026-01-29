/**
 * 同步服务测试
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, rm, readFile, access } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import { ObsidianSync, createObsidianSync } from '../src/sync';
import type { Observation, ObservationMetadata, Summary, SummaryMetadata } from '../src/types';

const TEST_VAULT_PATH = path.join(process.cwd(), 'test-vault');

describe('ObsidianSync', () => {
  beforeEach(async () => {
    // 创建测试 vault 目录
    await mkdir(TEST_VAULT_PATH, { recursive: true });
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await rm(TEST_VAULT_PATH, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  });

  describe('createObsidianSync', () => {
    test('应该使用默认配置创建实例', () => {
      const sync = createObsidianSync({ vaultPath: TEST_VAULT_PATH });
      const config = sync.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.vaultPath).toBe(TEST_VAULT_PATH);
      expect(config.baseFolder).toBe('ClaudeCode');
      expect(config.syncObservations).toBe(true);
      expect(config.syncSummaries).toBe(true);
    });

    test('应该允许自定义配置', () => {
      const sync = createObsidianSync({
        vaultPath: TEST_VAULT_PATH,
        baseFolder: 'CustomFolder',
        syncObservations: false
      });
      const config = sync.getConfig();

      expect(config.baseFolder).toBe('CustomFolder');
      expect(config.syncObservations).toBe(false);
    });
  });

  describe('isEnabled', () => {
    test('启用时应该返回 true', () => {
      const sync = createObsidianSync({ vaultPath: TEST_VAULT_PATH });
      expect(sync.isEnabled()).toBe(true);
    });

    test('禁用时应该返回 false', () => {
      const sync = createObsidianSync({
        vaultPath: TEST_VAULT_PATH,
        enabled: false
      });
      expect(sync.isEnabled()).toBe(false);
    });

    test('没有 vaultPath 时应该返回 false', () => {
      const sync = new ObsidianSync({
        enabled: true,
        vaultPath: '',
        baseFolder: 'ClaudeCode',
        syncObservations: true,
        syncSummaries: true
      });
      expect(sync.isEnabled()).toBe(false);
    });
  });

  describe('syncObservation', () => {
    const mockObservation: Observation = {
      type: 'bugfix',
      title: '测试观察',
      subtitle: '测试副标题',
      facts: ['事实1', '事实2'],
      narrative: '测试叙述',
      concepts: ['problem-solution'],
      files_read: ['src/test.ts'],
      files_modified: ['src/fix.ts']
    };

    const mockMetadata: ObservationMetadata = {
      id: 1,
      sessionId: 'test-session',
      project: 'test-project',
      promptNumber: 1,
      createdAtEpoch: new Date('2026-01-28').getTime()
    };

    test('应该创建观察笔记文件', async () => {
      const sync = createObsidianSync({ vaultPath: TEST_VAULT_PATH });
      const result = await sync.syncObservation(mockObservation, mockMetadata);

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();

      // 验证文件存在
      await access(result.filePath!, constants.F_OK);

      // 验证文件内容
      const content = await readFile(result.filePath!, 'utf-8');
      expect(content).toContain('id: 1');
      expect(content).toContain('type: bugfix');
      expect(content).toContain('# 🔴 测试观察');
    });

    test('禁用时应该跳过同步', async () => {
      const sync = createObsidianSync({
        vaultPath: TEST_VAULT_PATH,
        syncObservations: false
      });
      const result = await sync.syncObservation(mockObservation, mockMetadata);

      expect(result.success).toBe(true);
      expect(result.filePath).toBeUndefined();
    });

    test('应该按月份组织文件夹', async () => {
      const sync = createObsidianSync({ vaultPath: TEST_VAULT_PATH });
      const result = await sync.syncObservation(mockObservation, mockMetadata);

      expect(result.filePath).toContain('2026-01');
      expect(result.filePath).toContain('观察');
    });
  });

  describe('syncSummary', () => {
    const mockSummary: Summary = {
      request: '测试请求',
      investigated: '测试调查',
      learned: '测试学习',
      completed: '测试完成',
      next_steps: '测试下一步',
      notes: '测试备注'
    };

    const mockMetadata: SummaryMetadata = {
      id: 1,
      sessionId: 'test-session',
      project: 'test-project',
      promptNumber: 1,
      createdAtEpoch: new Date('2026-01-28').getTime()
    };

    test('应该创建摘要笔记文件', async () => {
      const sync = createObsidianSync({ vaultPath: TEST_VAULT_PATH });
      const result = await sync.syncSummary(mockSummary, mockMetadata);

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();

      // 验证文件存在
      await access(result.filePath!, constants.F_OK);

      // 验证文件内容
      const content = await readFile(result.filePath!, 'utf-8');
      expect(content).toContain('id: 1');
      expect(content).toContain('# 📋 测试请求');
      expect(content).toContain('## 调查内容');
    });

    test('禁用时应该跳过同步', async () => {
      const sync = createObsidianSync({
        vaultPath: TEST_VAULT_PATH,
        syncSummaries: false
      });
      const result = await sync.syncSummary(mockSummary, mockMetadata);

      expect(result.success).toBe(true);
      expect(result.filePath).toBeUndefined();
    });
  });

  describe('批量同步', () => {
    test('syncObservations 应该同步多个观察', async () => {
      const sync = createObsidianSync({ vaultPath: TEST_VAULT_PATH });
      const items = [
        {
          observation: {
            type: 'bugfix',
            title: '观察1',
            subtitle: null,
            facts: [],
            narrative: null,
            concepts: [],
            files_read: [],
            files_modified: []
          },
          metadata: {
            id: 1,
            sessionId: 'test',
            project: 'test',
            promptNumber: 1,
            createdAtEpoch: Date.now()
          }
        },
        {
          observation: {
            type: 'feature',
            title: '观察2',
            subtitle: null,
            facts: [],
            narrative: null,
            concepts: [],
            files_read: [],
            files_modified: []
          },
          metadata: {
            id: 2,
            sessionId: 'test',
            project: 'test',
            promptNumber: 2,
            createdAtEpoch: Date.now()
          }
        }
      ];

      const results = await sync.syncObservations(items);

      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    test('syncSummaries 应该同步多个摘要', async () => {
      const sync = createObsidianSync({ vaultPath: TEST_VAULT_PATH });
      const items = [
        {
          summary: {
            request: '摘要1',
            investigated: '',
            learned: '',
            completed: '',
            next_steps: '',
            notes: null
          },
          metadata: {
            id: 1,
            sessionId: 'test',
            project: 'test',
            promptNumber: 1,
            createdAtEpoch: Date.now()
          }
        },
        {
          summary: {
            request: '摘要2',
            investigated: '',
            learned: '',
            completed: '',
            next_steps: '',
            notes: null
          },
          metadata: {
            id: 2,
            sessionId: 'test',
            project: 'test',
            promptNumber: 2,
            createdAtEpoch: Date.now()
          }
        }
      ];

      const results = await sync.syncSummaries(items);

      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });
});
