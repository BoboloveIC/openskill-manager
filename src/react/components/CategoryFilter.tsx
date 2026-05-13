// 技能自然分类定义
export interface SkillCategory {
  id: string;
  icon: string;
  labelKey: string; // i18n key
  keywords: string[]; // 匹配关键词（用于自动分类）
}

export const CATEGORIES: SkillCategory[] = [
  {
    id: 'all',
    icon: '🌐',
    labelKey: 'allCategories',
    keywords: [],
  },
  {
    id: 'code',
    icon: '💻',
    labelKey: 'categoryCode',
    keywords: ['code', 'coding', '编程', '开发', 'program', 'develop', 'build', 'debug', 'refactor',
      'compile', 'deploy', 'git', 'lint', 'test', 'ci/cd', 'devops', 'snippet', 'function', 'api',
      'typescript', 'javascript', 'python', 'golang', 'rust', 'java', 'react', 'vue', 'node'],
  },
  {
    id: 'write',
    icon: '✍️',
    labelKey: 'categoryWrite',
    keywords: ['write', 'writing', '写作', '撰写', '内容', 'content', 'text', 'copy', 'edit',
      '翻译', 'translate', 'proofread', 'blog', 'article', 'document', 'doc', 'markdown', 'report',
      'email', 'mail', 'letter'],
  },
  {
    id: 'design',
    icon: '🎨',
    labelKey: 'categoryDesign',
    keywords: ['design', '设计', 'ui', 'ux', 'image', '图片', 'photo', 'graphic', 'icon',
      'logo', 'illustration', '插画', 'svg', 'color', 'layout', 'visual', 'figma', 'mockup',
      'screenshot', 'diagram', 'chart', 'draw', 'paint'],
  },
  {
    id: 'data',
    icon: '📊',
    labelKey: 'categoryData',
    keywords: ['data', '数据', 'analytics', '分析', 'database', '数据库', 'sql', 'query', 'table',
      'csv', 'json', 'excel', 'spreadsheet', 'statistic', 'visualization', '可视化', 'etl',
      'import', 'export', 'transform', 'aggregate', 'metric'],
  },
  {
    id: 'ai',
    icon: '🤖',
    labelKey: 'categoryAI',
    keywords: ['ai', 'ml', '模型', 'model', 'llm', 'prompt', 'agent', '智能', 'gpt', 'claude',
      'embedding', 'fine-tune', '微调', 'rag', 'vector', 'neural', 'nlp', 'chatbot', '机器人',
      'automation', '推理', 'inference'],
  },
  {
    id: 'search',
    icon: '🔍',
    labelKey: 'categorySearch',
    keywords: ['search', '搜索', 'find', '查找', 'browse', '浏览', 'web', 'scrape', 'crawl',
      'index', 'lookup', 'research', '研究', 'discover', 'monitor', '监控', 'track', 'alert'],
  },
  {
    id: 'file',
    icon: '📁',
    labelKey: 'categoryFile',
    keywords: ['file', '文件', 'folder', '目录', 'path', '路径', 'manage', '管理', 'organize',
      '整理', 'archive', '压缩', 'zip', 'convert', '转换', 'rename', 'move', 'copy', 'sync',
      'backup', 'storage', 'cloud'],
  },
  {
    id: 'security',
    icon: '🛡️',
    labelKey: 'categorySecurity',
    keywords: ['security', '安全', 'encrypt', '加密', 'auth', '认证', 'permission', '权限',
      'firewall', 'vulnerability', '漏洞', 'scan', '扫描', 'audit', '审计', 'compliance',
      'privacy', '隐私'],
  },
  {
    id: 'communication',
    icon: '💬',
    labelKey: 'categoryCommunication',
    keywords: ['chat', '聊天', 'message', '消息', 'notification', '通知', 'social', '社交',
      'channel', '频道', 'group', '群组', 'slack', 'discord', 'telegram', 'wechat', '微信',
      'comment', '评论', 'reply', 'mention'],
  },
  {
    id: 'productivity',
    icon: '📋',
    labelKey: 'categoryProductivity',
    keywords: ['task', '任务', 'todo', 'schedule', '日程', 'calendar', '日历', 'note', '笔记',
      'reminder', '提醒', 'timer', '计时', 'pomodoro', 'habit', '习惯', 'plan', '计划',
      'workflow', '工作流', 'template', '模板'],
  },
  {
    id: 'media',
    icon: '🎬',
    labelKey: 'categoryMedia',
    keywords: ['video', '视频', 'audio', '音频', 'music', '音乐', 'voice', '语音', 'tts',
      'speech', '播客', 'podcast', 'stream', '直播', 'recording', '录制', 'subtitle', '字幕',
      'transcript', 'media', '媒体'],
  },
  {
    id: 'devops',
    icon: '⚙️',
    labelKey: 'categoryDevOps',
    keywords: ['server', '服务器', 'docker', 'kubernetes', 'k8s', 'container', '容器', 'cloud',
      '云', 'aws', 'azure', 'gcp', 'terraform', 'ansible', 'deploy', '部署', 'release',
      'pipeline', 'infrastructure', 'monitor', 'log', '日志', 'config', '配置', 'install',
      'setup', 'environment'],
  },
  {
    id: 'other',
    icon: '📦',
    labelKey: 'categoryOther',
    keywords: [],
  },
];

/**
 * 根据技能的元数据自动推断分类
 */
export function classifySkill(skill: {
  name?: string;
  description?: string;
  categories?: string[];
  keywords?: string[];
  path?: string;
  platform?: string;
}): string {
  // 收集所有文本信息
  const texts = [
    skill.name || '',
    skill.description || '',
    ...(skill.categories || []),
    ...(skill.keywords || []),
    skill.path || '',
    skill.platform || '',
  ].join(' ').toLowerCase();

  // 如果 skill 自带分类，尝试匹配
  if (skill.categories && skill.categories.length > 0) {
    for (const cat of CATEGORIES) {
      if (cat.id === 'all' || cat.id === 'other') continue;
      if (skill.categories.some(c => c.toLowerCase().includes(cat.id) || cat.keywords.includes(c.toLowerCase()))) {
        return cat.id;
      }
    }
  }

  // 关键词匹配，计算每个分类的匹配分数
  const scores: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    if (cat.id === 'all' || cat.id === 'other') continue;
    scores[cat.id] = 0;
    for (const kw of cat.keywords) {
      if (texts.includes(kw.toLowerCase())) {
        scores[cat.id] += 1;
      }
    }
  }

  // 返回最高分的分类
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] > 0) {
    return best[0];
  }

  return 'other';
}

/**
 * 为技能批量分配分类
 */
export function classifySkills(skills: Array<{
  id: string;
  name?: string;
  description?: string;
  categories?: string[];
  keywords?: string[];
  path?: string;
  platform?: string;
}>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const skill of skills) {
    result[skill.id] = classifySkill(skill);
  }
  return result;
}
