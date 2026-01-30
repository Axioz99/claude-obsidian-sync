/**
 * 格式化工具测试
 */

import { describe, test, expect } from 'bun:test';
import {
  sanitizeFileName,
  formatYearMonth,
  formatIsoDate,
  generateFrontmatter,
  formatObservationNote,
  formatSummaryNote,
  TYPE_EMOJI_MAP
} from '../src/formatter';
import type { Observation, ObservationMetadata, Summary, SummaryMetadata } from '../src/types';

describe('sanitizeFileName', () => {
  test('应该移除非法字符', () => {
    expect(sanitizeFileName('file<>:"/\\|?*name')).toBe('file_name');
  });

  test('应该将空格转换为下划线', () => {
    expect(sanitizeFileName('hello world test')).toBe('hello_world_test');
  });

  test('应该合并多个下划线', () => {
    expect(sanitizeFileName('hello___world')).toBe('hello_world');
  });

  test('应该去除首尾下划线', () => {
    expect(sanitizeFileName('_hello_')).toBe('hello');
  });

  test('应该限制长度为80字符', () => {
    const longName = 'a'.repeat(100);
    expect(sanitizeFileName(longName).length).toBe(80);
  });

  test('空值应该返回 untitled', () => {
    expect(sanitizeFileName(null)).toBe('untitled');
    expect(sanitizeFileName(undefined)).toBe('untitled');
    expect(sanitizeFileName('')).toBe('untitled');
  });
});

describe('formatYearMonth', () => {
  test('应该格式化为 YYYY-MM', () => {
    const epoch = new Date('2026-01-28').getTime();
    expect(formatYearMonth(epoch)).toBe('2026-01');
  });

  test('月份应该补零', () => {
    const epoch = new Date('2026-05-15').getTime();
    expect(formatYearMonth(epoch)).toBe('2026-05');
  });
});

describe('formatIsoDate', () => {
  test('应该返回 ISO 格式日期', () => {
    const epoch = new Date('2026-01-28T10:30:00Z').getTime();
    expect(formatIsoDate(epoch)).toBe('2026-01-28T10:30:00.000Z');
  });
});

describe('generateFrontmatter', () => {
  test('应该生成基本 frontmatter', () => {
    const result = generateFrontmatter({
      id: 123,
      type: 'bugfix',
      project: 'test'
    });
    expect(result).toContain('---');
    expect(result).toContain('id: 123');
    expect(result).toContain('type: bugfix');
    expect(result).toContain('project: test');
  });

  test('应该处理数组', () => {
    const result = generateFrontmatter({
      tags: ['tag1', 'tag2']
    });
    expect(result).toContain('tags:');
    expect(result).toContain('  - tag1');
    expect(result).toContain('  - tag2');
  });

  test('应该跳过 null 和 undefined', () => {
    const result = generateFrontmatter({
      id: 123,
      empty: null,
      missing: undefined
    });
    expect(result).not.toContain('empty');
    expect(result).not.toContain('missing');
  });

  test('应该跳过空数组', () => {
    const result = generateFrontmatter({
      id: 123,
      tags: []
    });
    expect(result).not.toContain('tags');
  });
});

describe('formatObservationNote', () => {
  const mockObservation: Observation = {
    type: 'bugfix',
    title: '修复登录问题',
    subtitle: '用户无法登录',
    facts: ['发现问题', '修复问题'],
    narrative: '这是一个详细的叙述',
    concepts: ['problem-solution'],
    files_read: ['src/login.ts'],
    files_modified: ['src/auth.ts']
  };

  const mockMetadata: ObservationMetadata = {
    id: 123,
    sessionId: 'session-abc',
    project: 'test-project',
    promptNumber: 1,
    createdAtEpoch: new Date('2026-01-28T10:30:00Z').getTime()
  };

  test('应该包含 frontmatter', () => {
    const result = formatObservationNote(mockObservation, mockMetadata);
    expect(result).toContain('---');
    expect(result).toContain('id: 123');
    expect(result).toContain('type: bugfix');
  });

  test('应该包含标题和 emoji', () => {
    const result = formatObservationNote(mockObservation, mockMetadata);
    expect(result).toContain('# 🔴 修复登录问题');
  });

  test('应该包含副标题作为引用', () => {
    const result = formatObservationNote(mockObservation, mockMetadata);
    expect(result).toContain('> 用户无法登录');
  });

  test('应该包含事实列表', () => {
    const result = formatObservationNote(mockObservation, mockMetadata);
    expect(result).toContain('## 事实');
    expect(result).toContain('- 发现问题');
    expect(result).toContain('- 修复问题');
  });

  test('应该包含叙述', () => {
    const result = formatObservationNote(mockObservation, mockMetadata);
    expect(result).toContain('## 叙述');
    expect(result).toContain('这是一个详细的叙述');
  });

  test('应该包含概念标签', () => {
    const result = formatObservationNote(mockObservation, mockMetadata);
    expect(result).toContain('#ClaudeCode/concept/problem-solution');
  });

  test('应该包含相关文件', () => {
    const result = formatObservationNote(mockObservation, mockMetadata);
    expect(result).toContain('`src/login.ts`');
    expect(result).toContain('`src/auth.ts`');
  });
});

describe('formatSummaryNote', () => {
  const mockSummary: Summary = {
    request: '实现用户认证',
    investigated: '研究了多种方案',
    learned: '学到了 JWT',
    completed: '完成了登录功能',
    next_steps: '添加注册功能',
    notes: '需要注意安全'
  };

  const mockMetadata: SummaryMetadata = {
    id: 456,
    sessionId: 'session-abc',
    project: 'test-project',
    promptNumber: 5,
    createdAtEpoch: new Date('2026-01-28T10:30:00Z').getTime()
  };

  test('应该包含 frontmatter', () => {
    const result = formatSummaryNote(mockSummary, mockMetadata);
    expect(result).toContain('---');
    expect(result).toContain('id: 456');
  });

  test('应该包含标题', () => {
    const result = formatSummaryNote(mockSummary, mockMetadata);
    expect(result).toContain('# 📋 实现用户认证');
  });

  test('应该包含所有章节', () => {
    const result = formatSummaryNote(mockSummary, mockMetadata);
    expect(result).toContain('## 调查内容');
    expect(result).toContain('## 学到的知识');
    expect(result).toContain('## 完成的工作');
    expect(result).toContain('## 下一步计划');
    expect(result).toContain('## 备注');
  });
});

describe('TYPE_EMOJI_MAP', () => {
  test('应该包含所有类型', () => {
    expect(TYPE_EMOJI_MAP.bugfix).toBe('🔴');
    expect(TYPE_EMOJI_MAP.feature).toBe('🟣');
    expect(TYPE_EMOJI_MAP.refactor).toBe('🔄');
    expect(TYPE_EMOJI_MAP.change).toBe('✅');
    expect(TYPE_EMOJI_MAP.discovery).toBe('🔵');
    expect(TYPE_EMOJI_MAP.decision).toBe('⚖️');
  });
});
