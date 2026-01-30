/**
 * Claude Obsidian Sync - 格式化工具
 *
 * 将观察和摘要数据格式化为 Obsidian Markdown 笔记
 */

import type { Observation, Summary, ObservationMetadata, SummaryMetadata } from './types.js';

/**
 * 观察类型到 Emoji 的映射
 */
export const TYPE_EMOJI_MAP: Record<string, string> = {
  bugfix: '🔴',
  feature: '🟣',
  refactor: '🔄',
  change: '✅',
  discovery: '🔵',
  decision: '⚖️'
};

/**
 * 清理字符串用于文件名
 * 移除非法字符并限制长度
 */
export function sanitizeFileName(name: string | null | undefined): string {
  if (!name) return 'untitled';

  return name
    .replace(/[<>:"/\\|?*]/g, '_')  // 移除非法字符
    .replace(/\s+/g, '_')           // 空格转下划线
    .replace(/_+/g, '_')            // 合并多个下划线
    .replace(/^_|_$/g, '')          // 去除首尾下划线
    .substring(0, 80);              // 限制长度
}

/**
 * 格式化日期为 YYYY-MM（用于文件夹组织）
 */
export function formatYearMonth(epoch: number): string {
  const date = new Date(epoch);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * 格式化日期为 ISO 字符串（用于 frontmatter）
 */
export function formatIsoDate(epoch: number): string {
  return new Date(epoch).toISOString();
}

/**
 * 格式化日期为可读格式
 */
export function formatReadableDate(epoch: number): string {
  const date = new Date(epoch);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 生成 YAML frontmatter
 */
export function generateFrontmatter(data: Record<string, unknown>): string {
  const lines: string[] = ['---'];

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else if (typeof value === 'string' && value.includes('\n')) {
      // 多行字符串
      lines.push(`${key}: |`);
      for (const line of value.split('\n')) {
        lines.push(`  ${line}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}

/**
 * 格式化观察记录为 Obsidian Markdown 笔记
 */
export function formatObservationNote(
  obs: Observation,
  metadata: ObservationMetadata
): string {
  const emoji = TYPE_EMOJI_MAP[obs.type] || '📝';

  // 构建标签数组
  const tags: string[] = [
    'ClaudeCode/observation',
    `ClaudeCode/type/${obs.type}`,
    `ClaudeCode/project/${sanitizeFileName(metadata.project)}`
  ];

  // 添加概念标签
  for (const concept of obs.concepts || []) {
    tags.push(`ClaudeCode/concept/${concept}`);
  }

  // 构建 frontmatter
  const frontmatter = generateFrontmatter({
    id: metadata.id,
    type: obs.type,
    project: metadata.project,
    session_id: metadata.sessionId,
    prompt_number: metadata.promptNumber,
    created_at: formatIsoDate(metadata.createdAtEpoch),
    tags,
    files_read: obs.files_read || [],
    files_modified: obs.files_modified || []
  });

  // 构建内容
  const sections: string[] = [];

  // 标题
  sections.push(`# ${emoji} ${obs.title || '无标题观察'}`);
  sections.push('');

  // 副标题作为引用块
  if (obs.subtitle) {
    sections.push(`> ${obs.subtitle}`);
    sections.push('');
  }

  // 元信息
  sections.push(`**类型**: ${obs.type} | **时间**: ${formatReadableDate(metadata.createdAtEpoch)} | **项目**: ${metadata.project}`);
  sections.push('');

  // 事实
  if (obs.facts && obs.facts.length > 0) {
    sections.push('## 事实');
    for (const fact of obs.facts) {
      sections.push(`- ${fact}`);
    }
    sections.push('');
  }

  // 叙述
  if (obs.narrative) {
    sections.push('## 叙述');
    sections.push(obs.narrative);
    sections.push('');
  }

  // 概念标签
  if (obs.concepts && obs.concepts.length > 0) {
    sections.push('## 概念标签');
    sections.push(obs.concepts.map(c => `#ClaudeCode/concept/${c}`).join(' '));
    sections.push('');
  }

  // 相关文件
  if ((obs.files_read && obs.files_read.length > 0) || (obs.files_modified && obs.files_modified.length > 0)) {
    sections.push('## 相关文件');

    if (obs.files_read && obs.files_read.length > 0) {
      sections.push('### 读取');
      for (const file of obs.files_read) {
        sections.push(`- \`${file}\``);
      }
    }

    if (obs.files_modified && obs.files_modified.length > 0) {
      sections.push('### 修改');
      for (const file of obs.files_modified) {
        sections.push(`- \`${file}\``);
      }
    }
    sections.push('');
  }

  return frontmatter + '\n\n' + sections.join('\n');
}

/**
 * 格式化摘要为 Obsidian Markdown 笔记
 */
export function formatSummaryNote(
  summary: Summary,
  metadata: SummaryMetadata
): string {
  // 构建标签数组
  const tags: string[] = [
    'ClaudeCode/summary',
    `ClaudeCode/project/${sanitizeFileName(metadata.project)}`
  ];

  // 构建 frontmatter
  const frontmatter = generateFrontmatter({
    id: metadata.id,
    project: metadata.project,
    session_id: metadata.sessionId,
    prompt_number: metadata.promptNumber,
    created_at: formatIsoDate(metadata.createdAtEpoch),
    tags
  });

  // 构建内容
  const sections: string[] = [];

  // 标题
  sections.push(`# 📋 ${summary.request || '无标题摘要'}`);
  sections.push('');

  // 元信息
  sections.push(`**时间**: ${formatReadableDate(metadata.createdAtEpoch)} | **项目**: ${metadata.project}`);
  sections.push('');

  // 调查内容
  if (summary.investigated) {
    sections.push('## 调查内容');
    sections.push(summary.investigated);
    sections.push('');
  }

  // 学到的知识
  if (summary.learned) {
    sections.push('## 学到的知识');
    sections.push(summary.learned);
    sections.push('');
  }

  // 完成的工作
  if (summary.completed) {
    sections.push('## 完成的工作');
    sections.push(summary.completed);
    sections.push('');
  }

  // 下一步计划
  if (summary.next_steps) {
    sections.push('## 下一步计划');
    sections.push(summary.next_steps);
    sections.push('');
  }

  // 备注
  if (summary.notes) {
    sections.push('## 备注');
    sections.push(summary.notes);
    sections.push('');
  }

  return frontmatter + '\n\n' + sections.join('\n');
}
