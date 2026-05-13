import React from 'react';
import { Platform, stripDot } from './App';
import { useLanguage } from '../i18n';
import PlatformIconWithFallback from './PlatformIcon';
import { CATEGORIES, classifySkill } from './CategoryFilter';

interface SidebarProps {
  platforms: Platform[];
  selectedPlatform: string | null;
  selectedCategory: string;
  platformStats: Record<string, number>;
  skills: any[];
  onPlatformSelect: (platform: string) => void;
  onCategorySelect: (category: string) => void;
  onAddDirectory: () => void;
  activeTab: 'skill' | 'plugin' | 'extension';
  typeStats: { skill: number; plugin: number; extension: number };
}

const Sidebar: React.FC<SidebarProps> = ({
  platforms,
  selectedPlatform,
  selectedCategory,
  platformStats,
  skills,
  onPlatformSelect,
  onCategorySelect,
  onAddDirectory,
  activeTab,
  typeStats,
}) => {
  const { t } = useLanguage();
  const totalSkills = Object.values(platformStats).reduce((sum, count) => sum + count, 0);

  // 计算每个分类的技能数量（只统计当前 activeTab 的）
  const categoryStats: Record<string, number> = {};
  for (const skill of skills) {
    if ((skill.type || 'skill') !== activeTab) continue; // 按当前 tab 过滤
    const cat = classifySkill({
      name: skill.name,
      description: skill.description,
      categories: skill.categories,
      keywords: skill.keywords,
      path: skill.path,
      platform: skill.platform,
    });
    categoryStats[cat] = (categoryStats[cat] || 0) + 1;
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>AI</h2>
        <button className="add-btn" onClick={onAddDirectory} title={t('addDirectory')}>
          ➕
        </button>
      </div>

      <div className="platform-list">
        {/* 全部技能 */}
        <div
          className={`platform-item ${selectedPlatform === 'all' && selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => { onPlatformSelect('all'); onCategorySelect('all'); }}
        >
          <span className="platform-icon">🌐</span>
          <span className="platform-name">{t('allSkills')}</span>
          <span className="platform-count">{totalSkills}</span>
        </div>

        {/* 平台列表 */}
        <div className="section-divider">
          <span>{t('platforms')}</span>
        </div>

        {platforms.map(platform => (
          <div
            key={platform.name}
            className={`platform-item ${selectedPlatform === platform.name ? 'active' : ''}`}
            onClick={() => onPlatformSelect(platform.name)}
          >
            <PlatformIconWithFallback name={stripDot(platform.name)} size={20} />
            <span className="platform-name">{stripDot(platform.name)}</span>
            <span className="platform-count">{platformStats[platform.name] || 0}</span>
          </div>
        ))}

        {platformStats['custom'] > 0 && (
          <div
            className={`platform-item ${selectedPlatform === 'custom' ? 'active' : ''}`}
            onClick={() => onPlatformSelect('custom')}
          >
            <span className="platform-icon">📁</span>
            <span className="platform-name">{t('customDirs')}</span>
            <span className="platform-count">{platformStats['custom'] || 0}</span>
          </div>
        )}

        {/* 分类筛选 */}
        <div className="section-divider">
          <span>{t('filterByCategory')}</span>
        </div>

        {CATEGORIES.map(cat => {
          if (cat.id === 'all') return null;
          const count = categoryStats[cat.id] || 0;
          if (count === 0 && cat.id === 'other') {
            // Always show "Other" category
          } else if (count === 0) {
            return null; // Hide empty categories
          }
          return (
            <div
              key={cat.id}
              className={`platform-item category-item ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => onCategorySelect(cat.id)}
            >
              <span className="platform-icon category-icon">{cat.icon}</span>
              <span className="platform-name">{t(cat.labelKey as any)}</span>
              <span className="platform-count">{count}</span>
            </div>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <p>{platforms.length} {t('platforms')} · {typeStats.skill}📦 {typeStats.plugin}🔌 {typeStats.extension}🧩</p>
      </div>
    </aside>
  );
};

export default Sidebar;
