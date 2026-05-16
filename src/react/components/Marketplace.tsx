// ============================================================
// OpenSkill Manager - 技能广场组件 (真实数据版)
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
  stats?: any;
}

interface MarketplaceSource {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  color: string;
}

interface Props {
  onInstallSuccess?: (skill: MarketplaceSkill, platform: string) => void;
}

// 安装目标平台弹窗
const InstallDialog: React.FC<{
  skill: MarketplaceSkill,
  platforms: string[],
  onConfirm: (targetPlatform: string) => void,
  onCancel: () => void,
  installing?: boolean,
  result?: { success: boolean; message: string } | null
}> = ({ skill, platforms, onConfirm, onCancel, installing, result }) => {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(platforms[0] || '');
  return (
    <div className="modal-overlay">
      <div className="modal-box">
        {installing ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div className="marketplace-spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
              <h3>{t('marketplaceInstalling') || 'Installing...'}</h3>
            </div>
            <p style={{ color: '#888', fontSize: 13 }}>{skill.name} → {selected}</p>
          </>
        ) : result ? (
          <>
            <h3 style={{ color: result.success ? '#16a34a' : '#dc2626' }}>
              {result.success ? '✅' : '❌'} {result.message}
            </h3>
            <p style={{ color: '#888', fontSize: 13 }}>{skill.name}</p>
            <div className="modal-actions">
              <button onClick={onCancel}>{t('close') || 'Close'}</button>
            </div>
          </>
        ) : (
          <>
            <h3>{t('marketplaceInstallTitle') || 'Install to Platform'}</h3>
            <p>{skill.name} <small style={{ opacity: 0.6 }}>v{skill.version}</small></p>
            <label>{t('marketplaceSelectPlatform') || 'Select Target Platform'}</label>
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
            >
              {platforms.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <div className="modal-actions">
              <button onClick={onCancel}>{t('cancel') || 'Cancel'}</button>
              <button onClick={() => onConfirm(selected)}>
                {t('marketplaceInstall') || 'Install'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Marketplace: React.FC<Props> = ({ onInstallSuccess }) => {
  const { t } = useLanguage();
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [sources, setSources] = useState<MarketplaceSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installTarget, setInstallTarget] = useState<MarketplaceSkill | null>(null);
  const [installResult, setInstallResult] = useState<{ success: boolean; message: string } | null>(null);

  // 筛选
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // 分类选项
  const CATEGORIES = [
    { value: 'all', label: t('filterAll') || '全部' },
    { value: 'search', label: '🔍 ' + (t('categorySearch') || '搜索') },
    { value: 'code', label: '💻 ' + (t('categoryCode') || '编程') },
    { value: 'devops', label: '🔧 ' + (t('categoryDevops') || 'DevOps') },
    { value: 'media', label: '📰 ' + (t('categoryMedia') || '媒体') },
    { value: 'storage', label: '📦 ' + (t('categoryStorage') || '存储') },
    { value: 'communication', label: '💬 ' + (t('categoryCommunication') || '通讯') },
    { value: 'utility', label: '🛠️ ' + (t('categoryUtility') || '工具') },
  ];

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [skillsData, sourcesData] = await Promise.all([
          (window as any).electronAPI.getMarketplaceSkills(),
          (window as any).electronAPI.getMarketplaceSources()
        ]);
        // 检查已安装
        const localData = await (window as any).electronAPI.getSkills();
        const installedIds = new Set(localData.skills.map((s: any) => s.marketplaceId).filter(Boolean));
        const withInstalled = (skillsData || []).map((s: any) => ({
          ...s,
          installed: installedIds.has(s.id)
        }));
        setSkills(withInstalled);
        setSources(sourcesData || []);
      } catch (e) {
        console.error('Failed to load marketplace:', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // 搜索（去抖）
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) return;
      try {
        const results = await (window as any).electronAPI.searchMarketplace(searchQuery, 'clawhub');
        if (results && results.length > 0) {
          const localData = await (window as any).electronAPI.getSkills();
          const installedIds = new Set(localData.skills.map((s: any) => s.marketplaceId).filter(Boolean));
          setSkills(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const newSkills = results
              .filter((r: any) => !existingIds.has(r.id))
              .map((r: any) => ({ ...r, installed: installedIds.has(r.id) }));
            return [...prev.filter(s => s.id.startsWith('clawhub:') && s.id !== 'clawhub:search'), ...newSkills];
          });
        }
      } catch (e) { console.error('Search failed:', e); }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 过滤
  const filtered = React.useMemo(() => {
    let result = skills;
    if (selectedSource !== 'all') {
      result = result.filter(s => s.source === selectedSource);
    }
    if (selectedCategory !== 'all') {
      result = result.filter(s => s.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags?.some(tag => tag.toLowerCase().includes(q))
      );
    }
    return result;
  }, [skills, selectedSource, selectedCategory, searchQuery]);

  // 来源列表
  const sourceOptions = React.useMemo(() => {
    const srcSet = new Set(skills.map(s => s.source));
    return ['all', ...Array.from(srcSet)];
  }, [skills]);

  // 统计
  const stats = React.useMemo(() => ({
    total: skills.length,
    sources: sourceOptions.length - 1,
    installed: skills.filter(s => s.installed).length
  }), [skills, sourceOptions]);

  // 安装
  const handleInstall = useCallback((skill: MarketplaceSkill) => {
    setInstallTarget(skill);
    setInstallResult(null);
  }, []);

  const confirmInstall = useCallback(async (targetPlatform: string) => {
    if (!installTarget) return;
    setInstalling(installTarget.id);
    try {
      const result = await (window as any).electronAPI.installMarketplaceSkill(installTarget, targetPlatform);
      if (result.success) {
        setSkills(prev => prev.map(s => s.id === installTarget.id ? { ...s, installed: true } : s));
        setInstallResult({ success: true, message: result.note 
          ? (t('marketplaceInstallSuccess') || 'Installed!') + ` (${result.note})`
          : (t('marketplaceInstallSuccess') || 'Installed successfully!')
        });
        onInstallSuccess?.(installTarget, targetPlatform);
      } else {
        setInstallResult({ success: false, message: result.error || 'Installation failed' });
      }
    } catch (e: any) {
      setInstallResult({ success: false, message: e.message || 'Installation failed' });
    } finally {
      setInstalling(null);
      // 不自动关闭弹窗，让用户看到结果并手动关闭
    }
  }, [installTarget, onInstallSuccess, t]);

  return (
    <div className="marketplace">
      {/* 统计栏 */}
      <div className="marketplace-stats">
        <span className="stat-chip">{stats.total}&thinsp;{t('marketplaceSkills') || '个技能'}</span>
        <span className="stat-sep">·</span>
        <span className="stat-chip">{stats.sources}&thinsp;{t('marketplaceSources') || '个来源'}</span>
        {stats.installed > 0 && (
          <>
            <span className="stat-sep">·</span>
            <span className="stat-chip installed-chip">{stats.installed}&thinsp;{t('marketplaceInstalled') || '已安装'}</span>
          </>
        )}
      </div>

      {/* 搜索和筛选 */}
      <div className="marketplace-toolbar">
        <input
          type="text"
          className="search-input marketplace-search"
          placeholder={t('marketplaceSearchPlaceholder') || '搜索技能广场...'}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <div className="marketplace-source-filters">
          {sourceOptions.map(src => (
            <button
              key={src}
              className={`source-filter-btn ${selectedSource === src ? 'active' : ''}`}
              onClick={() => setSelectedSource(src)}
            >
              {src === 'all' ? '🌐 ' + (t('filterAll') || '全部') : src}
            </button>
          ))}
        </div>
        <div className="marketplace-category-filters">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              className={`source-filter-btn ${selectedCategory === cat.value ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.value)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 结果 */}
      {loading ? (
        <div className="marketplace-empty">
          <div className="marketplace-spinner" />
          <p>{t('marketplaceLoading') || '加载中...'}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="marketplace-empty">
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <p>{t('marketplaceNoResults') || '未找到匹配的技能'}</p>
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
                <span className="marketplace-card-source" title={skill.sourceUrl}>
                  📍 {skill.source}
                </span>
                <span className="marketplace-card-author">👤 {skill.author}</span>
              </div>
              <div className="marketplace-card-tags">
                {skill.tags.slice(0, 4).map(tag => (
                  <span key={tag} className="marketplace-tag">{tag}</span>
                ))}
                <span className={`marketplace-category-badge cat-${skill.category}`}>
                  {CATEGORIES.find(c => c.value === skill.category)?.label.split(' ')[1] || skill.category}
                </span>
              </div>
              <div className="marketplace-card-platforms">
                {(skill.platforms || []).slice(0, 5).map(p => (
                  <span key={p} className="marketplace-platform">{p}</span>
                ))}
              </div>
              <div className="marketplace-card-actions">
                {skill.installed ? (
                  <button className="action-btn installed" disabled>
                    ✅ {t('marketplaceInstalled') || '已安装'}
                  </button>
                ) : (
                  <button
                    className="action-btn primary"
                    onClick={() => handleInstall(skill)}
                    disabled={installing === skill.id}
                  >
                    {installing === skill.id
                      ? (t('marketplaceInstalling') || '安装中...')
                      : (t('marketplaceInstall') || '安装到平台')}
                  </button>
                )}
                <button
                  className="action-btn"
                  onClick={() => window.open(skill.sourceUrl, '_blank')}
                  title={t('marketplaceViewSource') || '查看来源'}
                >
                  🔗
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 安装弹窗 */}
      {installTarget && (
        <InstallDialog
          skill={installTarget}
          platforms={['openclaw', 'qclaw', 'claude', 'cursor', 'vscode', 'trae', 'skillhub', 'zen', 'zencoder', 'zagent']}
          onConfirm={confirmInstall}
          onCancel={() => { setInstallTarget(null); setInstallResult(null); }}
          installing={!!installing && installing === installTarget.id}
          result={installResult}
        />
      )}

      {/* 安装结果提示 */}
      {installResult && (
        <div className={`install-toast ${installResult.success ? 'success' : 'error'}`}>
          {installResult.success ? '✅ ' : '❌ '}{installResult.message}
        </div>
      )}
    </div>
  );
};

export default Marketplace;
export type { MarketplaceSkill, MarketplaceSource };