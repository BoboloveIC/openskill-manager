// ============================================================
// OpenSkill Manager - 技能广场组件
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n';

export interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  source: string;
  sourceUrl: string;
  downloadUrl: string;
  category: string;
  tags: string[];
  platforms: string[];
  installed: boolean;
}

interface Props {
  onInstall?: (skill: MarketplaceSkill, targetPlatform: string) => void;
}

const Marketplace: React.FC<Props> = ({ onInstall }) => {
  const { t } = useLanguage();
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);

  // 模拟数据 — 后续替换为真实数据源
  useEffect(() => {
    const mockSkills: MarketplaceSkill[] = [
      {
        id: 'ms-1', name: 'online-search', description: 'Web search integration with Tencent Yuanbao',
        version: '1.0.0', author: 'OpenClaw', source: 'SkillHub', sourceUrl: 'https://skillhub.dev/skills/online-search',
        downloadUrl: '', category: 'search', tags: ['search', 'web'], platforms: ['openclaw', 'qclaw'], installed: false,
      },
      {
        id: 'ms-2', name: 'coding-agent', description: 'Delegate coding tasks to Codex, Claude Code, or Pi agents',
        version: '1.2.0', author: 'OpenClaw', source: 'GitHub', sourceUrl: 'https://github.com/openclaw/coding-agent',
        downloadUrl: '', category: 'code', tags: ['coding', 'ai'], platforms: ['openclaw', 'qclaw', 'claude'], installed: false,
      },
      {
        id: 'ms-3', name: 'multi-search-engine', description: 'Multi search engine integration with 17 engines',
        version: '2.0.1', author: 'Community', source: 'SkillHub', sourceUrl: 'https://skillhub.dev/skills/multi-search-engine',
        downloadUrl: '', category: 'search', tags: ['search', 'multi-engine'], platforms: ['openclaw', 'qclaw'], installed: false,
      },
      {
        id: 'ms-4', name: 'github-skill', description: 'GitHub repository, issues, PRs and Actions management',
        version: '1.1.0', author: 'Community', source: 'GitHub', sourceUrl: 'https://github.com/openclaw/github-skill',
        downloadUrl: '', category: 'devops', tags: ['github', 'git'], platforms: ['openclaw', 'qclaw', 'cursor'], installed: false,
      },
      {
        id: 'ms-5', name: 'tech-news-digest', description: 'Tech news aggregation from 100+ sources with scoring',
        version: '1.0.0', author: 'Community', source: 'npm', sourceUrl: 'https://npmjs.com/package/openclaw-skill-tech-news',
        downloadUrl: '', category: 'media', tags: ['news', 'rss'], platforms: ['openclaw', 'qclaw'], installed: false,
      },
      {
        id: 'ms-6', name: 'mcp-builder', description: 'Guide for creating MCP servers to integrate external APIs',
        version: '1.0.0', author: 'OpenClaw', source: 'GitHub', sourceUrl: 'https://github.com/openclaw/mcp-builder',
        downloadUrl: '', category: 'code', tags: ['mcp', 'api'], platforms: ['openclaw', 'qclaw', 'claude'], installed: false,
      },
    ];
    setSkills(mockSkills);
  }, []);

  // 过滤
  const filtered = React.useMemo(() => {
    let result = skills;
    if (selectedSource !== 'all') {
      result = result.filter(s => s.source === selectedSource);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }
    return result;
  }, [skills, selectedSource, searchQuery]);

  // 来源列表
  const sources = React.useMemo(() => {
    const set = new Set(skills.map(s => s.source));
    return ['all', ...Array.from(set)];
  }, [skills]);

  const handleInstall = async (skill: MarketplaceSkill) => {
    setInstalling(skill.id);
    // 后续接真实安装逻辑
    setTimeout(() => {
      setSkills(prev => prev.map(s => s.id === skill.id ? { ...s, installed: true } : s));
      setInstalling(null);
    }, 1000);
  };

  return (
    <div className="marketplace">
      {/* 搜索和筛选 */}
      <div className="marketplace-toolbar">
        <input
          type="text"
          className="search-input marketplace-search"
          placeholder={t('marketplaceSearchPlaceholder')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <div className="marketplace-source-filters">
          {sources.map(src => (
            <button
              key={src}
              className={`source-filter-btn ${selectedSource === src ? 'active' : ''}`}
              onClick={() => setSelectedSource(src)}
            >
              {src === 'all' ? '🌐 All' : src}
            </button>
          ))}
        </div>
      </div>

      {/* 结果 */}
      {loading ? (
        <div className="marketplace-empty">
          <div className="marketplace-spinner" />
          <p>Loading...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="marketplace-empty">
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <p>{t('marketplaceNoResults')}</p>
        </div>
      ) : (
        <div className="marketplace-grid">
          {filtered.map(skill => (
            <div key={skill.id} className="marketplace-card">
              <div className="marketplace-card-header">
                <h3 className="marketplace-card-name">{skill.name}</h3>
                <span className="marketplace-card-version">v{skill.version}</span>
              </div>
              <p className="marketplace-card-desc">{skill.description}</p>
              <div className="marketplace-card-meta">
                <span className="marketplace-card-source">📍 {skill.source}</span>
                <span className="marketplace-card-author">👤 {skill.author}</span>
              </div>
              <div className="marketplace-card-tags">
                {skill.tags.map(tag => (
                  <span key={tag} className="marketplace-tag">{tag}</span>
                ))}
              </div>
              <div className="marketplace-card-platforms">
                {skill.platforms.map(p => (
                  <span key={p} className="marketplace-platform">{p}</span>
                ))}
              </div>
              <div className="marketplace-card-actions">
                {skill.installed ? (
                  <button className="action-btn installed" disabled>
                    ✅ {t('marketplaceInstalled')}
                  </button>
                ) : (
                  <button
                    className="action-btn primary"
                    onClick={() => handleInstall(skill)}
                    disabled={installing === skill.id}
                  >
                    {installing === skill.id ? t('marketplaceInstalling') : t('marketplaceInstallTo')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Marketplace;
