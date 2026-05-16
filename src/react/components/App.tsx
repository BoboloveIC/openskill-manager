import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './Sidebar';
import SkillGrid from './SkillGrid';
import SkillDetail from './SkillDetail';
import PlatformDetail from './PlatformDetail';
import AddDirectoryModal from './AddDirectoryModal';
import MigrateModal from './MigrateModal';
import ImportModal from './ImportModal';
import Marketplace from './Marketplace';
import { LanguageSelector } from './LanguageSelector';
import { ThemeSelector } from './ThemeSelector';
import { useLanguage } from '../i18n';
import { classifySkill } from './CategoryFilter';
import '../styles/App.css';
import '../styles/themes.css';

// 工具函数：去掉平台名称前的 "."（如 .claude → claude）
export function stripDot(name: string): string {
  return name.startsWith('.') ? name.slice(1) : name;
}

export interface Skill {
  id: string;
  name: string;
  platform: string;
  path: string;
  description: string;
  version: string;
  enabled: boolean;
  author?: string;
  license?: string;
  categories?: string[];
  keywords?: string[];
  discoveredAt?: string;
  updatedAt?: string;
  migratedFrom?: string;
  migratedAt?: string;
  type: 'skill' | 'plugin' | 'extension'; // 扩展类型
}

export interface Platform {
  name: string;
  path: string;
  hasSkills: boolean;
  skillsPath: string;
  extensionPaths?: Array<{ type: string; path: string }>;
  isCustom: boolean;
  discoveredAt: string;
  skillCount?: number;
}

export interface DatabaseData {
  version: string;
  updatedAt: string;
  platforms: Platform[];
  skills: Skill[];
  customPaths: string[];
}

interface ScanProgress {
  phase: string;
  message: string;
  step?: number;
  total?: number;
  current?: string;
  done?: boolean;
  found?: boolean;
  skill?: string;
  totalSkills?: number;
  platformCount?: number;
  skillCount?: number;
  error?: string;
  timestamp: number;
}

interface ScanLog {
  message: string;
  timestamp: number;
  type: 'info' | 'success' | 'error' | 'progress';
}

const App: React.FC = () => {
  const { t } = useLanguage();
  const [data, setData] = useState<DatabaseData>({
    version: '', updatedAt: '', platforms: [], skills: [], customPaths: []
  });
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'skill' | 'plugin' | 'extension' | 'marketplace'>('skill'); // 类型切换
  const [scanning, setScanning] = useState(true); // 初始为 true，等待自动扫描
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [skillToMigrate, setSkillToMigrate] = useState<Skill | null>(null);

  // 扫描进度
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanResult, setScanResult] = useState<{ platformCount: number; skillCount: number } | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动日志
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [scanLogs]);

  // 扫描超时保护：3 分钟无进度更新则强制结束扫描
  useEffect(() => {
    if (!scanning || scanComplete) return;
    const timer = setTimeout(() => {
      console.warn('Scan timeout, forcing exit');
      setScanning(false);
      setScanComplete(true);
      setScanResult({ platformCount: data.platforms.length, skillCount: data.skills.length });
    }, 3 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [scanning, scanComplete]);

  // 监听扫描进度
  useEffect(() => {
    (window as any).electronAPI.onScanProgress((p: ScanProgress) => {
      setProgress(p);

      // 生成日志条目
      let logType: ScanLog['type'] = 'progress';
      if (p.found || p.done) logType = 'success';
      if (p.error || p.phase === 'error') logType = 'error';
      if (p.phase === 'start') logType = 'info';

      setScanLogs(prev => {
        // 去重高频消息
        const last = prev[prev.length - 1];
        if (last && last.message === p.message) return prev;
        return [...prev.slice(-199), { message: p.message, timestamp: p.timestamp, type: logType }];
      });

      if (p.phase === 'done') {
        setScanning(false);
        setScanComplete(true);
        setScanResult({ platformCount: p.platformCount || 0, skillCount: p.skillCount || 0 });
      }
      if (p.phase === 'error') {
        setScanning(false);
      }
    });

    (window as any).electronAPI.onSkillsUpdated((result: DatabaseData) => {
      setData(result);
      if (result.platforms.length > 0 && !selectedPlatform) {
        setSelectedPlatform(result.platforms[0].name);
      }
      setScanning(false);
      setScanComplete(true);
    });

    (window as any).electronAPI.onAddCustomDirectory((dirPath: string) => {
      setShowAddModal(true);
    });

    return () => {
      (window as any).electronAPI.removeAllListeners('scan-progress');
      (window as any).electronAPI.removeAllListeners('skills-updated');
      (window as any).electronAPI.removeAllListeners('add-custom-directory');
    };
  }, [selectedPlatform]);

  // 手动重新扫描
  const scanAll = useCallback(async () => {
    setScanning(true);
    setScanComplete(false);
    setScanResult(null);
    setScanLogs([]);
    setProgress(null);
    setSelectedSkill(null);
    try {
      const result = await (window as any).electronAPI.scanAll();
      setData(result);
      if (result.platforms.length > 0 && !selectedPlatform) {
        setSelectedPlatform(result.platforms[0].name);
      }
    } catch (error) {
      console.error('Failed to scan:', error);
    } finally {
      setScanning(false);
    }
  }, [selectedPlatform]);

  // 过滤技能
  const filteredSkills = React.useMemo(() => {
    let skills = data.skills;
    // 类型筛选 (skill/plugin/extension)
    skills = skills.filter(s => (s.type || 'skill') === activeTab);
    // 平台筛选 — 分类筛选激活时忽略平台限制
    if (selectedPlatform && selectedPlatform !== 'all' && selectedCategory === 'all') {
      skills = skills.filter(s => s.platform === selectedPlatform);
    }
    // 分类筛选（跨所有平台）
    if (selectedCategory && selectedCategory !== 'all') {
      skills = skills.filter(s =>
        classifySkill({
          name: s.name,
          description: s.description,
          categories: s.categories,
          keywords: s.keywords,
          path: s.path,
          platform: s.platform,
        }) === selectedCategory
      );
    }
    // 搜索
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      skills = skills.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.categories?.some(c => c.toLowerCase().includes(q)) ||
        s.keywords?.some(k => k.toLowerCase().includes(q))
      );
    }
    return skills;
  }, [data.skills, selectedPlatform, selectedCategory, searchQuery, activeTab]);

  // 平台技能数统计（按类型）
  const platformStats = React.useMemo(() => {
    const stats: Record<string, number> = {};
    for (const skill of data.skills) {
      if ((skill.type || 'skill') === activeTab) {
        stats[skill.platform] = (stats[skill.platform] || 0) + 1;
      }
    }
    return stats;
  }, [data.skills, activeTab]);

  // 各类型总数统计
  const typeStats = React.useMemo(() => {
    const stats = { skill: 0, plugin: 0, extension: 0 };
    for (const skill of data.skills) {
      const t = skill.type || 'skill';
      if (t in stats) stats[t]++;
      else stats.skill++; // 未知类型归为 skill
    }
    return stats;
  }, [data.skills]);

  const handleAddDirectory = async () => {
    try {
      const selectedPath = await (window as any).electronAPI.selectDirectory();
      if (selectedPath) {
        await (window as any).electronAPI.addCustomPath(selectedPath);
        const result = await (window as any).electronAPI.getSkills();
        setData(result);
      }
    } catch (error) { console.error(error); }
    setShowAddModal(false);
  };

  const handleDeleteSkill = async (skillId: string) => {
    if (confirm(t('confirmDeleteMsg'))) {
      await (window as any).electronAPI.deleteSkill(skillId);
      const result = await (window as any).electronAPI.getSkills();
      setData(result);
      setSelectedSkill(null);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(skillId); return n; });
    }
  };

  // 多选切换
  const handleToggleSelect = useCallback((skillId: string, multi: boolean) => {
    setSelectedIds(prev => {
      if (!multi) {
        // 单击：重置为只选当前
        return new Set([skillId]);
      }
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(filteredSkills.map(s => s.id)));
  }, [filteredSkills]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleMigrate = (skill: Skill) => { setSkillToMigrate(skill); setShowMigrateModal(true); };

  const executeMigrate = async (targetPlatform: string) => {
    if (!skillToMigrate) return;
    const result = await (window as any).electronAPI.migrateSkill(skillToMigrate.id, targetPlatform);
    if (result.success) {
      const updated = await (window as any).electronAPI.getSkills();
      setData(updated);
    } else { alert(`Migration failed: ${result.error}`); }
    setShowMigrateModal(false);
    setSkillToMigrate(null);
  };

  // 批量迁移
  const [showBatchMigrateModal, setShowBatchMigrateModal] = useState(false);
  const handleBatchMigrate = () => {
    if (selectedIds.size === 0) { alert(t('noItemSelected')); return; }
    setShowBatchMigrateModal(true);
  };

  const executeBatchMigrate = async (targetPlatform: string) => {
    const ids = Array.from(selectedIds);
    let successCount = 0;
    for (const id of ids) {
      const result = await (window as any).electronAPI.migrateSkill(id, targetPlatform);
      if (result.success) successCount++;
    }
    const updated = await (window as any).electronAPI.getSkills();
    setData(updated);
    setShowBatchMigrateModal(false);
    setSelectedIds(new Set());
  };

  // 批量打包导出
  const handleBatchExport = async () => {
    if (selectedIds.size === 0) { alert(t('noItemSelected')); return; }
    try {
      const ids = Array.from(selectedIds);
      const selectedSkills = data.skills.filter(s => ids.includes(s.id));
      const result = await (window as any).electronAPI.exportSkills(ids);
      if (result.success) {
        alert(t('exportSuccess', { n: result.count }));
      } else {
        alert(t('exportFailed') + ': ' + (result.error || ''));
      }
    } catch (e: any) {
      alert(t('exportFailed') + ': ' + e.message);
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) { alert(t('noItemSelected')); return; }
    if (!confirm(t('confirmDeleteMsg') + ` (${selectedIds.size})`)) return;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await (window as any).electronAPI.deleteSkill(id);
    }
    const result = await (window as any).electronAPI.getSkills();
    setData(result);
    setSelectedSkill(null);
    setSelectedIds(new Set());
  };

  // 从 zip 文件导入
  const [showImportModal, setShowImportModal] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const overflowTriggerRef = useRef<HTMLButtonElement>(null);
  const overflowDropdownRef = useRef<HTMLDivElement>(null);
  const handleImportFromFile = async (filePath: string, targetPlatform: string) => {
    try {
      const result = await (window as any).electronAPI.importSkillsFromFile(filePath, targetPlatform);
      if (result.success) {
        const updated = await (window as any).electronAPI.getSkills();
        setData(updated);
        alert(t('importSuccess', { n: result.count }));
      } else {
        alert(t('importFailed') + ': ' + (result.error || ''));
      }
    } catch (e: any) {
      alert(t('importFailed') + ': ' + e.message);
    }
    setShowImportModal(false);
  };

  const handleOpenInFinder = async (filePath: string) => {
    await (window as any).electronAPI.openInFinder(filePath);
  };

  // 点击溢出菜单外部关闭
  useEffect(() => {
    if (!showOverflowMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (
        overflowTriggerRef.current && !overflowTriggerRef.current.contains(e.target as Node) &&
        overflowDropdownRef.current && !overflowDropdownRef.current.contains(e.target as Node)
      ) {
        setShowOverflowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showOverflowMenu]);

  // ===================== 渲染 =====================

  // 扫描中：显示全屏扫描进度
  if (scanning && !scanComplete) {
    return (
      <div className="app scan-view">
        <div className="scan-container">
          <div className="scan-header">
            <h1>🦞 {t('appTitle')}</h1>
            <p className="scan-subtitle">{t('scanningSubtitle')}</p>
          </div>

          {/* 进度指示 */}
          <div className="scan-progress-section">
            <div className="scan-phase">
              <span className="phase-label">{t('phase')}</span>
              <span className="phase-value">{progress?.phase || '...'}</span>
            </div>

            {progress && progress.total && progress.total > 0 && progress.step !== -1 && (
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.min(((progress.step || 0) / progress.total) * 100, 100)}%` }}
                />
                <span className="progress-text">{progress.step} / {progress.total}</span>
              </div>
            )}

            {progress && progress.message && (
              <div className="scan-current">
                <span className={`current-icon ${progress.found ? 'found' : ''}`}>
                  {progress.found ? '✅' : progress.error ? '❌' : '🔍'}
                </span>
                <span className="current-text">{progress.message}</span>
              </div>
            )}
          </div>

          {/* 实时日志 */}
          <div className="scan-log-container">
            <div className="scan-log-header">
              <span>📋 {t('scanLog')}</span>
              <span className="log-count">{scanLogs.length}</span>
            </div>
            <div className="scan-log-list">
              {scanLogs.length === 0 ? (
                <div className="log-placeholder">...</div>
              ) : (
                scanLogs.map((log, i) => (
                  <div key={i} className={`log-entry ${log.type}`}>
                    <span className="log-time">
                      {new Date(log.timestamp).toLocaleTimeString('zh-CN')}
                    </span>
                    <span className="log-message">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 扫描完成：显示结果摘要，然后可以进入主界面
  if (scanComplete && scanResult && data.skills.length === 0 && data.platforms.length === 0) {
    return (
      <div className="app scan-view">
        <div className="scan-container">
          <div className="scan-result-header">
            <h1>🦞 {t('appTitle')}</h1>
          </div>
          <div className="scan-result-empty">
            <div className="empty-icon-large">📭</div>
            <h2>{t('noSkillsFound')}</h2>
            <p>{t('noSkillsDesc')}</p>
            <div className="result-actions">
              <button className="action-btn primary" onClick={scanAll}>
                {t('rescan')}
              </button>
              <button className="action-btn secondary" onClick={() => setShowAddModal(true)}>
                {t('addCustomDirBtn')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 扫描完成：显示结果摘要 + 进入按钮
  if (scanComplete && scanResult) {
    return (
      <div className="app scan-view">
        <div className="scan-container">
          <div className="scan-result-header">
            <h1>🦞 {t('appTitle')}</h1>
          </div>
          <div className="scan-result-card">
            <div className="result-icon">✅</div>
            <h2>{t('scanComplete')}</h2>
            <div className="result-stats">
              <div className="result-stat">
                <div className="stat-number">{scanResult.platformCount}</div>
                <div className="stat-label">{t('platforms')}</div>
              </div>
              <div className="result-divider">|</div>
              <div className="result-stat">
                <div className="stat-number">{scanResult.skillCount}</div>
                <div className="stat-label">{t('skills')}</div>
              </div>
            </div>

            {/* 快速预览 */}
            {data.platforms.length > 0 && (
              <div className="result-preview">
                <h3>{t('discoveredPlatforms')}</h3>
                <div className="preview-platforms">
                  {data.platforms.map(p => (
                    <div key={p.name} className="preview-platform-item">
                      <span className="preview-name">{p.name}</span>
                      <span className="preview-count">{platformStats[p.name] || 0} {t('skills')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.skills.length > 0 && (
              <div className="result-preview">
                <h3>{t('discoveredSkills')}（20）</h3>
                <div className="preview-skills">
                  {data.skills.slice(0, 20).map(s => (
                    <div key={s.id} className="preview-skill-item">
                      <span className="preview-skill-name">{s.name}</span>
                      <span className="preview-skill-platform">{s.platform}</span>
                    </div>
                  ))}
                  {data.skills.length > 20 && (
                    <div className="preview-more">{t('moreSkills', { n: data.skills.length - 20 })}</div>
                  )}
                </div>
              </div>
            )}

            <div className="result-actions">
              <button className="action-btn primary large" onClick={() => setScanComplete(false)}>
                {t('enterApp')}
              </button>
              <button className="action-btn secondary" onClick={scanAll}>
                {t('rescan')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 主界面
  return (
    <div className="app">
      <Sidebar
        platforms={data.platforms}
        selectedPlatform={selectedPlatform}
        selectedCategory={selectedCategory}
        platformStats={platformStats}
        skills={data.skills}
        onPlatformSelect={(name) => { setSelectedPlatform(name); setSelectedSkill(null); setSelectedCategory('all'); }}
        onCategorySelect={(cat) => { setSelectedCategory(cat); setSelectedSkill(null); }}
        activeTab={activeTab}
        typeStats={typeStats}
        onAddDirectory={() => setShowAddModal(true)}
      />

      <div className="main-content">
        <header className="app-header">
          <div className="header-left">
            <h1>🦞 {t('appTitle')}</h1>
            <div className="type-tabs">
              <button
                className={`type-tab ${activeTab === 'skill' ? 'active' : ''}`}
                onClick={() => { setActiveTab('skill'); setSelectedSkill(null); setSelectedCategory('all'); }}
              >📦 {t('tabSkills')} <span className="tab-count">{typeStats.skill}</span></button>
              <button
                className={`type-tab ${activeTab === 'plugin' ? 'active' : ''}`}
                onClick={() => { setActiveTab('plugin'); setSelectedSkill(null); setSelectedCategory('all'); }}
              >🔌 {t('tabPlugins')} <span className="tab-count">{typeStats.plugin}</span></button>
              <button
                className={`type-tab ${activeTab === 'extension' ? 'active' : ''}`}
                onClick={() => { setActiveTab('extension'); setSelectedSkill(null); setSelectedCategory('all'); }}
              >🧩 {t('tabExtensions')} <span className="tab-count">{typeStats.extension}</span></button>
              <button
                className={`type-tab ${activeTab === 'marketplace' ? 'active' : ''}`}
                onClick={() => { setActiveTab('marketplace'); setSelectedSkill(null); setSelectedCategory('all'); }}
              >🌐 {t('tabMarketplace')} <span className="tab-count">{t('marketplaceNew')}</span></button>
            </div>
          </div>
          <div className="header-right">
            <input
              type="text"
              className="search-input"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="header-actions">
              <ThemeSelector />
              <LanguageSelector />
              <button className="scan-btn" onClick={scanAll} disabled={scanning}>
                <span>{scanning ? t('scanningBtn') : t('scanSkillsBtn')}</span>
              </button>
              <button className="action-btn secondary" onClick={() => setShowImportModal(true)}>
                📥 <span>{t('importFromFile')}</span>
              </button>
              <button className="action-btn secondary" onClick={() => setShowAddModal(true)}>
                📂 <span>{t('importFromDir')}</span>
              </button>
            </div>
            <div className="header-overflow-menu">
              <button
                className="overflow-trigger"
                onClick={() => setShowOverflowMenu(v => !v)}
                ref={overflowTriggerRef}
              >
                ☰
              </button>
              {showOverflowMenu && (
                <div className="overflow-dropdown" ref={overflowDropdownRef}>
                  <div className="overflow-section">
                    <ThemeSelector />
                    <LanguageSelector />
                  </div>
                  <div className="overflow-divider" />
                  <button className="overflow-item" onClick={() => { scanAll(); setShowOverflowMenu(false); }} disabled={scanning}>
                    🔄 {scanning ? t('scanningBtn') : t('scanSkillsBtn')}
                  </button>
                  <button className="overflow-item" onClick={() => { setShowImportModal(true); setShowOverflowMenu(false); }}>
                    📥 {t('importFromFile')}
                  </button>
                  <button className="overflow-item" onClick={() => { setShowAddModal(true); setShowOverflowMenu(false); }}>
                    📂 {t('importFromDir')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content-area">
          {activeTab === 'marketplace' ? (
            <Marketplace />
          ) : (
          <div className="content-grid">
            <div className="skill-section">
              <div className="section-header">
                <h2>
                  {selectedCategory !== 'all'
                    ? t(selectedCategory === 'code' ? 'categoryCode' :
                        selectedCategory === 'write' ? 'categoryWrite' :
                        selectedCategory === 'design' ? 'categoryDesign' :
                        selectedCategory === 'data' ? 'categoryData' :
                        selectedCategory === 'ai' ? 'categoryAI' :
                        selectedCategory === 'search' ? 'categorySearch' :
                        selectedCategory === 'file' ? 'categoryFile' :
                        selectedCategory === 'security' ? 'categorySecurity' :
                        selectedCategory === 'communication' ? 'categoryCommunication' :
                        selectedCategory === 'productivity' ? 'categoryProductivity' :
                        selectedCategory === 'media' ? 'categoryMedia' :
                        selectedCategory === 'devops' ? 'categoryDevOps' :
                        'categoryOther' as any)
                    : selectedPlatform === 'all' ? t('allSkills')
                    : selectedPlatform === 'custom' ? t('customDirs')
                    : stripDot(selectedPlatform || '')
                  }
                </h2>
                <span className="count">{filteredSkills.length}</span>
              </div>
              <SkillGrid
                skills={filteredSkills}
                selectedSkill={selectedSkill}
                selectedIds={selectedIds}
                onSelect={setSelectedSkill}
                onToggleSelect={handleToggleSelect}
                onDelete={handleDeleteSkill}
                onMigrate={handleMigrate}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
              />
            </div>

            <div className="detail-section">
              {selectedSkill ? (
                <SkillDetail
                  skill={selectedSkill}
                  onDelete={() => handleDeleteSkill(selectedSkill.id)}
                  onMigrate={() => handleMigrate(selectedSkill)}
                  onOpenFinder={handleOpenInFinder}
                />
              ) : selectedPlatform && selectedPlatform !== 'all' ? (
                <PlatformDetail
                  platform={data.platforms.find(p => p.name === selectedPlatform)}
                  skillCount={platformStats[selectedPlatform] || 0}
                  onOpenFinder={handleOpenInFinder}
                />
              ) : (
                <div className="detail-empty">
                  <p>{t('selectHint')}</p>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddDirectoryModal onClose={() => setShowAddModal(false)} onConfirm={handleAddDirectory} />
      )}

      {showMigrateModal && skillToMigrate && (
        <MigrateModal
          skill={skillToMigrate}
          targets={data.platforms.filter(p => p.name !== skillToMigrate.platform)}
          onClose={() => { setShowMigrateModal(false); setSkillToMigrate(null); }}
          onConfirm={executeMigrate}
        />
      )}

      {showBatchMigrateModal && (
        <MigrateModal
          skill={{ id: '__batch__', name: t('batchMigrate'), platform: '', path: '', description: '', version: '', enabled: true, type: 'skill' } as Skill}
          targets={data.platforms}
          batchCount={selectedIds.size}
          onClose={() => setShowBatchMigrateModal(false)}
          onConfirm={executeBatchMigrate}
        />
      )}

      {showImportModal && (
        <ImportModal
          platforms={data.platforms}
          onClose={() => setShowImportModal(false)}
          onConfirm={handleImportFromFile}
        />
      )}
    </div>
  );
};

export default App;